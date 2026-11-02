# -*- coding: utf-8 -*-
"""
ComfyUI FLUX.2 Manga Colorizer client for MangaShot with reference palette transfer fallback.
Connects to ComfyUI server, uploads page and reference, triggers FLUX.2 colorization,
and composites with the original luminance line art.
"""
from pathlib import Path
from typing import Dict, Any, Optional, Union, List
import copy
import mimetypes
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
        self.models = models or {
            "unet": "FLUX.2/flux-2-klein-base-9b-Q3_K_M.gguf",
            "clip": "Qwen/qwen_3_8b_fp4mixed.safetensors",
            "vae": "FLUX.2/flux2-vae.safetensors",
            "lora": "FLUX.2/manga_colorization.safetensors",
        }
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
                "white_threshold": 256.0,
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

    def colorize(
        self,
        page_bgr: np.ndarray,
        reference_path_or_bgr: Union[str, Path, np.ndarray],
        prefix: str = "mangashot",
        fallback_on_offline: bool = True,
    ) -> np.ndarray:
        """
        Colorize a manga page image using reference-guided FLUX.2 in ComfyUI.
        Falls back to reference-guided LAB Chroma Transfer if ComfyUI is offline.
        """
        if not self.check_connection():
            if fallback_on_offline and reference_path_or_bgr is not None:
                print(f"[Notice] ComfyUI server is offline at '{self.base_url}'. Using reference-guided LAB Chroma transfer.")
                return self.colorize_transfer(page_bgr, reference_path_or_bgr)
            raise ComfyColorizeError(
                f"Cannot connect to ComfyUI at '{self.base_url}'. "
                "Ensure ComfyUI is running with --extra-model-paths-config config/extra_model_paths.yaml"
            )

        ok, page_buf = cv2.imencode(".png", page_bgr)
        if not ok:
            raise ValueError("Failed to encode page image to PNG")

        if isinstance(reference_path_or_bgr, (str, Path)):
            ref_path = Path(reference_path_or_bgr)
            if not ref_path.is_file():
                raise FileNotFoundError(f"Reference image not found: {ref_path}")
            ref_buf = ref_path.read_bytes()
            ref_filename = f"ref_{uuid.uuid4().hex[:8]}_{ref_path.name}"
        else:
            ok, ref_buf = cv2.imencode(".png", reference_path_or_bgr)
            ref_filename = f"ref_{uuid.uuid4().hex[:8]}.png"

        page_filename = f"page_{uuid.uuid4().hex[:8]}.png"

        uploaded_page = self.upload_image(page_buf.tobytes(), page_filename)
        uploaded_ref = self.upload_image(ref_buf if isinstance(ref_buf, bytes) else ref_buf.tobytes(), ref_filename)

        prompt_graph = self._build_prompt_graph(uploaded_page, uploaded_ref, prefix)
        client_id = uuid.uuid4().hex
        payload = {"prompt": prompt_graph, "client_id": client_id}
        resp = requests.post(f"{self.base_url}/prompt", json=payload, timeout=60)
        resp.raise_for_status()
        prompt_id = resp.json()["prompt_id"]

        raw_color_bgr = self._poll_and_download(prompt_id, timeout=self.cfg.get("timeout", 3600))

        post_cfg = self.cfg.get("postprocess", {})
        final_colorized = composite_chroma(
            original_bgr=page_bgr,
            color_bgr=raw_color_bgr,
            radius=post_cfg.get("radius", 2),
            sat=post_cfg.get("sat", 1.0),
            white_threshold=post_cfg.get("white_threshold", 256.0),
            neutral_mask=post_cfg.get("neutral_mask", False),
        )
        return final_colorized

    def colorize_transfer(
        self,
        page_bgr: np.ndarray,
        reference_path_or_bgr: Union[str, Path, np.ndarray],
    ) -> np.ndarray:
        """Reference-guided LAB Chroma Transfer with Guided Filter L preservation."""
        if isinstance(reference_path_or_bgr, (str, Path)):
            ref = imread_unicode(reference_path_or_bgr)
        else:
            ref = reference_path_or_bgr

        h, w = page_bgr.shape[:2]
        ref_resized = cv2.resize(ref, (w, h), interpolation=cv2.INTER_AREA)

        t_lab = cv2.cvtColor(page_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        r_lab = cv2.cvtColor(ref_resized, cv2.COLOR_BGR2LAB).astype(np.float32)

        l_t = t_lab[:, :, 0]
        a_r = r_lab[:, :, 1] - 128.0
        b_r = r_lab[:, :, 2] - 128.0

        # Apply guided filter for smooth chroma bleeding along line boundaries
        guide = l_t / 255.0
        a_r = guided_filter(guide, a_r, radius=4, eps=1e-3)
        b_r = guided_filter(guide, b_r, radius=4, eps=1e-3)

        # Keep pure white speech bubble / paper clear
        paper_mask = l_t > 235
        a_r[paper_mask] = 0.0
        b_r[paper_mask] = 0.0

        out_lab = np.dstack([l_t, a_r + 128.0, b_r + 128.0]).clip(0, 255).astype(np.uint8)
        return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)

    def _build_prompt_graph(self, page_name: str, ref_name: str, prefix: str) -> Dict[str, Any]:
        res_steps = int(self.cfg.get("resolution_steps", 16))
        return {
            "70": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": self.models["unet"]}},
            "88": {"class_type": "LoraLoaderModelOnly", "inputs": {
                "model": ["70", 0], "lora_name": self.models["lora"], "strength_model": float(self.cfg.get("lora_strength", 1.0))
            }},
            "71": {"class_type": "CLIPLoader", "inputs": {"clip_name": self.models["clip"], "type": "flux2", "device": "default"}},
            "72": {"class_type": "VAELoader", "inputs": {"vae_name": self.models["vae"]}},
            "81": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
            "85": {"class_type": "ImageScaleToTotalPixels", "inputs": {
                "image": ["81", 0], "upscale_method": "nearest-exact", "megapixels": float(self.cfg.get("megapixels", 0.5)), "resolution_steps": res_steps
            }},
            "220": {"class_type": "RepeatImageBatch", "inputs": {"image": ["85", 0], "amount": 1}},
            "106": {"class_type": "VAEEncode", "inputs": {"pixels": ["220", 0], "vae": ["72", 0]}},
            "74": {"class_type": "CLIPTextEncode", "inputs": {"text": self.cfg.get("prompt", "mngclranm"), "clip": ["71", 0]}},
            "87": {"class_type": "CLIPTextEncode", "inputs": {"text": self.cfg.get("negative", ""), "clip": ["71", 0]}},
            "107": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["77", 0], "latent": ["106", 0]}},
            "105": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["104", 0], "latent": ["106", 0]}},
            "63": {"class_type": "CFGGuider", "inputs": {
                "model": ["88", 0], "positive": ["107", 0], "negative": ["105", 0], "cfg": float(self.cfg.get("cfg", 4.0))
            }},
            "73": {"class_type": "RandomNoise", "inputs": {"noise_seed": int(self.cfg.get("seed", 1234))}},
            "61": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
            "64": {"class_type": "SamplerCustomAdvanced", "inputs": {
                "noise": ["73", 0], "guider": ["63", 0], "sampler": ["61", 0], "sigmas": ["62", 0], "latent_image": ["66", 0]
            }},
            "65": {"class_type": "VAEDecode", "inputs": {"samples": ["64", 0], "vae": ["72", 0]}},
            "94": {"class_type": "SaveImage", "inputs": {"images": ["65", 0], "filename_prefix": prefix}},
            "201": {"class_type": "LoadImage", "inputs": {"image": page_name}},
            "80": {"class_type": "ImageScaleToTotalPixels", "inputs": {
                "image": ["201", 0], "upscale_method": "nearest-exact", "megapixels": float(self.cfg.get("megapixels", 0.5)), "resolution_steps": res_steps
            }},
            "103": {"class_type": "GetImageSize", "inputs": {"image": ["80", 0]}},
            "66": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": ["103", 0], "height": ["103", 1], "batch_size": 1}},
            "62": {"class_type": "Flux2Scheduler", "inputs": {"steps": int(self.cfg.get("steps", 20)), "width": ["103", 0], "height": ["103", 1]}},
            "78": {"class_type": "VAEEncode", "inputs": {"pixels": ["80", 0], "vae": ["72", 0]}},
            "77": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["74", 0], "latent": ["78", 0]}},
            "104": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["87", 0], "latent": ["78", 0]}},
        }

    def _poll_and_download(self, prompt_id: str, timeout: int = 3600) -> np.ndarray:
        start_time = time.time()
        while time.time() - start_time < timeout:
            resp = requests.get(f"{self.base_url}/history/{prompt_id}", timeout=30)
            if resp.status_code == 200:
                history = resp.json()
                if prompt_id in history:
                    data = history[prompt_id]
                    outputs = data.get("outputs", {})
                    images = outputs.get("94", {}).get("images", [])
                    if images:
                        img_info = images[0]
                        fn = img_info["filename"]
                        sub = img_info.get("subfolder", "")
                        typ = img_info.get("type", "output")
                        view_url = f"{self.base_url}/view?filename={fn}&subfolder={sub}&type={typ}"
                        view_resp = requests.get(view_url, timeout=60)
                        view_resp.raise_for_status()
                        img_buf = np.frombuffer(view_resp.content, dtype=np.uint8)
                        return cv2.imdecode(img_buf, cv2.IMREAD_COLOR)

                    status = data.get("status", {})
                    if status.get("status_str") == "error":
                        raise ComfyColorizeError(f"ComfyUI prompt failed: {status.get('messages', [])}")

            time.sleep(1.5)

        raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id} after {timeout}s")
