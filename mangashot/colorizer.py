# -*- coding: utf-8 -*-
"""
ComfyUI FLUX.2 Manga Colorizer client for MangaShot with reference palette transfer fallback.
Connects to ComfyUI server, uploads page and reference, triggers FLUX.2 colorization,
and composites with the original luminance line art.
"""
from pathlib import Path
from typing import Dict, Any, Optional, Union, List, Sequence
import hashlib
import mimetypes
import re
import time
import uuid
import cv2
import numpy as np
import requests

from .utils import imread_unicode, imwrite_unicode
from .postprocess import composite_chroma, guided_filter


class ComfyColorizeError(RuntimeError):
    pass


class MangaColorizer:
    """Interfaces with ComfyUI FLUX.2 Manga Colorization workflow with local transfer fallback."""

    def __init__(
        self,
        comfyui_url: str = "http://127.0.0.1:8000",
        models: Optional[Dict[str, str]] = None,
        cfg: Optional[Dict[str, Any]] = None,
    ):
        self.base_url = comfyui_url.rstrip("/")
        import os
        raw_models = models or {
            "unet": "FLUX.2/flux-2-klein-base-9b-Q3_K_M.gguf",
            "clip": "Qwen/qwen_3_8b_fp4mixed.safetensors",
            "vae": "FLUX.2/flux2-vae.safetensors",
            "lora": "FLUX.2/manga_colorization.safetensors",
        }
        self.models = {k: os.path.normpath(v) for k, v in raw_models.items()}
        self._object_info: Optional[Dict[str, Any]] = None
        self.cfg = cfg or {
            "megapixels": 0.5,
            "resolution_steps": 16,
            "steps": 20,
            "cfg": 4.0,
            "seed": 1234,
            "lora_strength": 1.0,
            "prompt": "mngclranm",
            "negative": "",
            "timeout": 3600,
            "postprocess": {
                "radius": 2,
                "sat": 1.0,
                "white_threshold": 245.0,
                "neutral_mask": False,
            },
        }

    def check_connection(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/system_stats", timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def upload_image(self, img_data: bytes, filename: str) -> str:
        mime = mimetypes.guess_type(filename)[0] or "image/png"
        files = {"image": (filename, img_data, mime)}
        data = {"overwrite": "true"}
        resp = requests.post(f"{self.base_url}/upload/image", files=files, data=data, timeout=60)
        resp.raise_for_status()
        uploaded_name = resp.json().get("name", filename)
        return uploaded_name

    def _stable_upload_name(self, data: bytes, stem: str, suffix: str = ".png") -> str:
        """Content-addressed upload name so ComfyUI can cache identical inputs."""
        digest = hashlib.sha1(data).hexdigest()[:12]
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", str(stem or "image"))[:40] or "image"
        suffix = suffix if suffix.startswith(".") else f".{suffix}"
        return f"mangashot_{digest}_{safe}{suffix.lower()}"

    def _upload_reference(self, reference_path_or_bgr: Union[str, Path, np.ndarray]) -> str:
        if isinstance(reference_path_or_bgr, (str, Path)):
            ref_path = Path(reference_path_or_bgr)
            if not ref_path.is_file():
                raise FileNotFoundError(f"Reference image not found: {ref_path}")
            data = ref_path.read_bytes()
            name = self._stable_upload_name(data, ref_path.stem, ref_path.suffix or ".png")
        else:
            ok, buf = cv2.imencode(".png", reference_path_or_bgr)
            if not ok:
                raise ValueError("Failed to encode reference image to PNG")
            data = buf.tobytes()
            name = self._stable_upload_name(data, "reference", ".png")
        return self.upload_image(data, name)

    def colorize(
        self,
        page_bgr: np.ndarray,
        reference_path_or_bgr: Union[str, Path, np.ndarray],
        prefix: str = "mangashot",
        color_mode: str = "composite",
        fallback_on_offline: bool = False,
    ) -> np.ndarray:
        """
        Colorize a single manga page (thin wrapper around ``colorize_batch``).
        """
        return self.colorize_batch(
            [page_bgr],
            reference_path_or_bgr,
            prefix=prefix,
            color_mode=color_mode,
            fallback_on_offline=fallback_on_offline,
            page_names=[prefix],
        )[0]

    def colorize_batch(
        self,
        page_bgrs: Sequence[np.ndarray],
        reference_path_or_bgr: Union[str, Path, np.ndarray],
        prefix: str = "mangashot",
        color_mode: str = "composite",
        fallback_on_offline: bool = False,
        page_names: Optional[Sequence[str]] = None,
    ) -> List[np.ndarray]:
        """Colorize several same-sized pages in one ComfyUI diffusion batch.

        This mirrors MangaColour's ``--batch-size`` path: every page is added to
        one ``ImageBatch`` tree and the sampler runs with ``batch_size=N``, so
        the 9B model is loaded/executed once for the whole group.  On 6 GB VRAM
        keep N at 2; larger groups spill weights to CPU and get slower.
        """
        pages = [p for p in page_bgrs if p is not None]
        if not pages:
            return []
        if len({tuple(p.shape[:2]) for p in pages}) != 1:
            raise ValueError("colorize_batch requires all pages to share the same width/height")

        if not self.check_connection():
            if fallback_on_offline and reference_path_or_bgr is not None:
                print(f"[Notice] ComfyUI server is offline at '{self.base_url}'. Using reference-guided LAB Chroma transfer.")
                return [
                    self.colorize_transfer(p, reference_path_or_bgr, color_mode=color_mode)
                    for p in pages
                ]
            raise ComfyColorizeError(
                f"Cannot connect to ComfyUI at '{self.base_url}'. "
                "Ensure ComfyUI is running with --extra-model-paths-config config/extra_model_paths.yaml"
            )

        uploaded_pages: List[str] = []
        for idx, page_bgr in enumerate(pages):
            ok, page_buf = cv2.imencode(".png", page_bgr)
            if not ok:
                raise ValueError(f"Failed to encode page #{idx + 1} to PNG")
            data = page_buf.tobytes()
            stem = page_names[idx] if page_names and idx < len(page_names) else f"{prefix}_{idx + 1:03d}"
            uploaded_pages.append(self.upload_image(data, self._stable_upload_name(data, stem, ".png")))

        try:
            uploaded_ref = self._upload_reference(reference_path_or_bgr)
            prompt_graph = self._build_batch_prompt_graph(
                uploaded_pages, uploaded_ref, prefix, len(pages)
            )
            client_id = uuid.uuid4().hex
            payload = {"prompt": prompt_graph, "client_id": client_id}
            resp = requests.post(f"{self.base_url}/prompt", json=payload, timeout=60)
            resp.raise_for_status()
            prompt_id = resp.json()["prompt_id"]

            raw_colors = self._poll_and_download_many(
                prompt_id, len(pages), timeout=self.cfg.get("timeout", 3600)
            )
        except Exception as e:
            if fallback_on_offline and reference_path_or_bgr is not None:
                print(f"[Warning] ComfyUI execution failed ({e}). Falling back to reference-guided LAB Chroma transfer.")
                return [
                    self.colorize_transfer(p, reference_path_or_bgr, color_mode=color_mode)
                    for p in pages
                ]
            raise ComfyColorizeError(f"ComfyUI colorization failed: {e}")

        outputs: List[np.ndarray] = []
        for page_bgr, raw_color_bgr in zip(pages, raw_colors):
            h, w = page_bgr.shape[:2]
            if color_mode == "direct":
                outputs.append(cv2.resize(raw_color_bgr, (w, h), interpolation=cv2.INTER_CUBIC))
                continue

            post_cfg = self.cfg.get("postprocess", {})
            outputs.append(composite_chroma(
                original_bgr=page_bgr,
                color_bgr=raw_color_bgr,
                radius=post_cfg.get("radius", 2),
                sat=post_cfg.get("sat", 1.0),
                white_threshold=post_cfg.get("white_threshold", 245.0),
                neutral_mask=post_cfg.get("neutral_mask", False),
            ))
        return outputs

    def colorize_transfer(
        self,
        page_bgr: np.ndarray,
        reference_path_or_bgr: Union[str, Path, np.ndarray],
        color_mode: str = "composite",
    ) -> np.ndarray:
        """Reference-guided LAB Chroma Transfer with proper color distribution."""
        if isinstance(reference_path_or_bgr, (str, Path)):
            ref = imread_unicode(reference_path_or_bgr)
        else:
            ref = reference_path_or_bgr

        h, w = page_bgr.shape[:2]
        t_lab = cv2.cvtColor(page_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_t = t_lab[:, :, 0]

        ref_resized = cv2.resize(ref, (w, h), interpolation=cv2.INTER_AREA)
        r_lab = cv2.cvtColor(ref_resized, cv2.COLOR_BGR2LAB).astype(np.float32)

        if color_mode == "direct":
            out_lab = np.dstack([l_t, r_lab[:, :, 1], r_lab[:, :, 2]]).clip(0, 255).astype(np.uint8)
            return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)

        # Smooth and guide the chroma channels
        guide = l_t / 255.0
        a_smooth = guided_filter(guide, r_lab[:, :, 1], radius=3, eps=1e-3)
        b_smooth = guided_filter(guide, r_lab[:, :, 2], radius=3, eps=1e-3)

        white_mask = l_t >= 245.0
        a_smooth[white_mask] = 128.0
        b_smooth[white_mask] = 128.0

        out_lab = np.dstack([l_t, a_smooth, b_smooth]).clip(0, 255).astype(np.uint8)
        return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)

    def resolve_model(self, node_class: str, input_field: str, wanted: str) -> str:
        """Resolve model name against ComfyUI object_info choices to prevent 400 validation errors."""
        if self._object_info is None:
            try:
                resp = requests.get(f"{self.base_url}/object_info", timeout=10)
                if resp.status_code == 200:
                    self._object_info = resp.json()
            except Exception:
                self._object_info = {}

        if self._object_info:
            node_spec = self._object_info.get(node_class, {}).get("input", {}).get("required", {}).get(input_field)
            if node_spec and isinstance(node_spec, list) and len(node_spec) > 0 and isinstance(node_spec[0], list):
                options = node_spec[0]
                if wanted in options:
                    return wanted
                wanted_norm = wanted.replace("/", "\\")
                if wanted_norm in options:
                    return wanted_norm
                wanted_base = wanted.replace("\\", "/").split("/")[-1].lower()
                for opt in options:
                    if str(opt).replace("\\", "/").split("/")[-1].lower() == wanted_base:
                        return str(opt)
        return wanted

    def _build_batch_prompt_graph(
        self,
        page_names: Sequence[str],
        ref_name: str,
        prefix: str,
        batch_size: int,
    ) -> Dict[str, Any]:
        """Build one FLUX.2 API graph for ``batch_size`` pages (MangaColour style)."""
        res_steps = int(self.cfg.get("resolution_steps", 16))
        unet_name = self.resolve_model("UnetLoaderGGUF", "unet_name", self.models["unet"])
        lora_name = self.resolve_model("LoraLoaderModelOnly", "lora_name", self.models["lora"])
        clip_name = self.resolve_model("CLIPLoader", "clip_name", self.models["clip"])
        vae_name = self.resolve_model("VAELoader", "vae_name", self.models["vae"])

        graph: Dict[str, Any] = {
            "70": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": unet_name}},
            "88": {"class_type": "LoraLoaderModelOnly", "inputs": {
                "model": ["70", 0], "lora_name": lora_name,
                "strength_model": float(self.cfg.get("lora_strength", 1.0))
            }},
            "71": {"class_type": "CLIPLoader", "inputs": {"clip_name": clip_name, "type": "flux2", "device": "default"}},
            "72": {"class_type": "VAELoader", "inputs": {"vae_name": vae_name}},
            "81": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
            "85": {"class_type": "ImageScaleToTotalPixels", "inputs": {
                "image": ["81", 0], "upscale_method": "nearest-exact",
                "megapixels": float(self.cfg.get("megapixels", 0.5)),
                "resolution_steps": res_steps,
            }},
            "220": {"class_type": "RepeatImageBatch", "inputs": {"image": ["85", 0], "amount": int(batch_size)}},
            "106": {"class_type": "VAEEncode", "inputs": {"pixels": ["220", 0], "vae": ["72", 0]}},
            "74": {"class_type": "CLIPTextEncode", "inputs": {"text": self.cfg.get("prompt", "mngclranm"), "clip": ["71", 0]}},
            "87": {"class_type": "CLIPTextEncode", "inputs": {"text": self.cfg.get("negative", ""), "clip": ["71", 0]}},
            "107": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["77", 0], "latent": ["106", 0]}},
            "105": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["104", 0], "latent": ["106", 0]}},
            "63": {"class_type": "CFGGuider", "inputs": {
                "model": ["88", 0], "positive": ["107", 0], "negative": ["105", 0],
                "cfg": float(self.cfg.get("cfg", 4.0)),
            }},
            "73": {"class_type": "RandomNoise", "inputs": {"noise_seed": int(self.cfg.get("seed", 1234))}},
            "61": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
            "64": {"class_type": "SamplerCustomAdvanced", "inputs": {
                "noise": ["73", 0], "guider": ["63", 0], "sampler": ["61", 0],
                "sigmas": ["62", 0], "latent_image": ["66", 0],
            }},
            "65": {"class_type": "VAEDecode", "inputs": {"samples": ["64", 0], "vae": ["72", 0]}},
            "94": {"class_type": "SaveImage", "inputs": {"images": ["65", 0], "filename_prefix": prefix}},
        }

        # Each page is a separate LoadImage; merge them into one IMAGE batch.
        current = []
        for i, image_name in enumerate(page_names):
            node_id = str(201 + i)
            graph[node_id] = {"class_type": "LoadImage", "inputs": {"image": image_name}}
            current.append(node_id)

        next_id = 221
        while len(current) > 1:
            merged = []
            for i in range(0, len(current), 2):
                if i + 1 == len(current):
                    merged.append(current[i])
                    continue
                node_id = str(next_id)
                next_id += 1
                graph[node_id] = {
                    "class_type": "ImageBatch",
                    "inputs": {"image1": [current[i], 0], "image2": [current[i + 1], 0]},
                }
                merged.append(node_id)
            current = merged

        graph["80"] = {"class_type": "ImageScaleToTotalPixels", "inputs": {
            "image": [current[0], 0], "upscale_method": "nearest-exact",
            "megapixels": float(self.cfg.get("megapixels", 0.5)),
            "resolution_steps": res_steps,
        }}
        graph["103"] = {"class_type": "GetImageSize", "inputs": {"image": ["80", 0]}}
        graph["66"] = {"class_type": "EmptyFlux2LatentImage", "inputs": {
            "width": ["103", 0], "height": ["103", 1], "batch_size": int(batch_size),
        }}
        graph["62"] = {"class_type": "Flux2Scheduler", "inputs": {
            "steps": int(self.cfg.get("steps", 20)), "width": ["103", 0], "height": ["103", 1],
        }}
        graph["78"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["80", 0], "vae": ["72", 0]}}
        graph["77"] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["74", 0], "latent": ["78", 0]}}
        graph["104"] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["87", 0], "latent": ["78", 0]}}
        return graph

    def _poll_and_download_many(self, prompt_id: str, expected_count: int, timeout: int = 3600) -> List[np.ndarray]:
        start_time = time.time()
        while time.time() - start_time < timeout:
            resp = requests.get(f"{self.base_url}/history/{prompt_id}", timeout=30)
            if resp.status_code == 200:
                history = resp.json()
                if prompt_id in history:
                    data = history[prompt_id]
                    outputs = data.get("outputs", {})
                    images = outputs.get("94", {}).get("images", [])

                    status = data.get("status", {})
                    if status.get("status_str") == "error":
                        raise ComfyColorizeError(f"ComfyUI prompt failed: {status.get('messages', [])}")

                    if images:
                        if len(images) < expected_count:
                            raise ComfyColorizeError(
                                f"ComfyUI returned {len(images)} image(s), expected {expected_count}"
                            )
                        results: List[np.ndarray] = []
                        for img_info in images[:expected_count]:
                            fn = img_info["filename"]
                            sub = img_info.get("subfolder", "")
                            typ = img_info.get("type", "output")
                            view_url = f"{self.base_url}/view?filename={fn}&subfolder={sub}&type={typ}"
                            view_resp = requests.get(view_url, timeout=120)
                            view_resp.raise_for_status()
                            img_buf = np.frombuffer(view_resp.content, dtype=np.uint8)
                            decoded = cv2.imdecode(img_buf, cv2.IMREAD_COLOR)
                            if decoded is None:
                                raise ComfyColorizeError(f"Failed to decode ComfyUI output: {fn}")
                            results.append(decoded)
                        return results

            time.sleep(1.5)

        raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id} after {timeout}s")

    def _poll_and_download(self, prompt_id: str, timeout: int = 3600) -> np.ndarray:
        return self._poll_and_download_many(prompt_id, 1, timeout=timeout)[0]
