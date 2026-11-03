# -*- coding: utf-8 -*-
"""
Main pipeline orchestrator for MangaShot:
Integrates MangaTranslate and MangaColour into a unified one-click system.
Supports Positional JSON Protocol, Whole-Chapter Narrative Coherence,
and Advanced Inpaint-Colorize-Typeset.
"""
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Tuple
import json
import time
import cv2
import numpy as np

from .utils import imread_unicode, imwrite_unicode, sort_reading_order, pad_box, deep_merge
from .inspector import ContentInspector
from .detector import BubbleDetector
from .ocr import MangaOcrWrapper
from .translator import GeminiTranslator
from .inpainter import MangaInpainter
from .typesetter import MangaTypesetter
from .colorizer import MangaColorizer, ComfyColorizeError

DEFAULT_CONFIG: Dict[str, Any] = {
    "pipeline": {
        "mode": "auto",
        "reference": "examples/sample_reference.jpg",
        "output_dir": "outputs",
        "save_intermediate": True,
        "save_qa": True,
        "save_json": True,
        "chapter_context": True,
        "color_batch_size": 2,
    },
    "api": {
        "base_url": "http://127.0.0.1:8045/v1",
        "api_key": "sk-42c3360b3d73446ab1c87b7ce35f9b99",
        "model": "gemini-3.8-flash-tiered",
        "temperature": 0.2,
        "timeout": 60,
        "max_retries": 3,
    },
    "comfyui": {
        "base_url": "http://127.0.0.1:8000",
        "models": {
            "unet": "FLUX.2/flux-2-klein-base-9b-Q3_K_M.gguf",
            "clip": "Qwen/qwen_3_8b_fp4mixed.safetensors",
            "vae": "FLUX.2/flux2-vae.safetensors",
            "lora": "FLUX.2/manga_colorization.safetensors",
        },
        "megapixels": 0.5,
        "resolution_steps": 16,
        # 2-step FLUX.2 Klein + the manga-colorization LoRA is the chosen
        # default: 1 step was faster/warmer but too pale for this project,
        # while 3-5 steps washed out further and cost 45-140% more time.
        "steps": 2,
        "cfg": 4.0,
        "seed": 1234,
        "lora_strength": 1.0,
        "prompt": "mngclranm",
        "negative": "",
        "timeout": 3600,
        "postprocess": {
            "radius": 2,
            # AB backfill discards the model's L channel, so bright line-art
            # areas otherwise lose chroma.  1.3 restores warm skin without
            # yellowing the paper like a "warm skin" text prompt does.
            "sat": 1.3,
            "white_threshold": 256.0,
            "neutral_mask": False,
        },
    },
    "detector": {
        "model_path": "models/detector/comic-speech-bubble-detector.pt",
        "conf": 0.25,
        "device": "cuda",
    },
    "ocr": {
        "model_path": "models/ocr/manga-ocr-base",
        "device": "cuda",
    },
    "inpainter": {
        "method": "telea",
        "inpaint_radius": 5,
        "dilate_kernel": 5,
        "threshold": 210,
    },
    "typesetter": {
        "font_path": "C:/Windows/Fonts/msyh.ttc",
        "fallback_font": "C:/Windows/Fonts/simhei.ttf",
        "vertical": "auto",
        "text_color": [0, 0, 0],
        "stroke_color": [255, 255, 255],
        "stroke_width": 2,
    },
}


class MangaShotPipeline:
    """One-click unified Manga Translation & Colorization Pipeline with positional integrity."""

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        config_path: Optional[Union[str, Path]] = None,
        lazy_models: bool = False,
    ):
        cfg = copy_cfg = dict(DEFAULT_CONFIG)
        if config_path and Path(config_path).is_file():
            loaded = json.loads(Path(config_path).read_text(encoding="utf-8"))
            cfg = deep_merge(cfg, loaded)
        if config:
            cfg = deep_merge(cfg, config)
        self.cfg = cfg
        self.lazy_models = lazy_models

        self._detector: Optional[BubbleDetector] = None
        self._ocr: Optional[MangaOcrWrapper] = None
        self._translator: Optional[GeminiTranslator] = None
        self._inpainter: Optional[MangaInpainter] = None
        self._typesetter: Optional[MangaTypesetter] = None
        self._colorizer: Optional[MangaColorizer] = None

        if not lazy_models:
            self._init_all()

    def _init_all(self):
        _ = self.detector
        _ = self.ocr
        _ = self.translator
        _ = self.inpainter
        _ = self.typesetter
        _ = self.colorizer

    @property
    def detector(self) -> BubbleDetector:
        if self._detector is None:
            self._detector = BubbleDetector(
                model_path=self.cfg["detector"]["model_path"],
                conf=self.cfg["detector"]["conf"],
                device=self.cfg["detector"]["device"],
            )
        return self._detector

    @property
    def ocr(self) -> MangaOcrWrapper:
        if self._ocr is None:
            self._ocr = MangaOcrWrapper(
                model_path=self.cfg["ocr"]["model_path"],
                device=self.cfg["ocr"]["device"],
            )
        return self._ocr

    @property
    def translator(self) -> GeminiTranslator:
        if self._translator is None:
            self._translator = GeminiTranslator(
                base_url=self.cfg["api"]["base_url"],
                api_key=self.cfg["api"]["api_key"],
                model=self.cfg["api"]["model"],
                temperature=self.cfg["api"]["temperature"],
                timeout=self.cfg["api"]["timeout"],
                max_retries=self.cfg["api"]["max_retries"],
            )
        return self._translator

    @property
    def inpainter(self) -> MangaInpainter:
        if self._inpainter is None:
            self._inpainter = MangaInpainter(
                method=self.cfg["inpainter"]["method"],
                inpaint_radius=self.cfg["inpainter"]["inpaint_radius"],
                dilate_kernel=self.cfg["inpainter"]["dilate_kernel"],
                threshold=self.cfg["inpainter"]["threshold"],
            )
        return self._inpainter

    @property
    def typesetter(self) -> MangaTypesetter:
        if self._typesetter is None:
            self._typesetter = MangaTypesetter(
                font_path=self.cfg["typesetter"].get("font_path"),
                fallback_font=self.cfg["typesetter"].get("fallback_font"),
                default_color=tuple(self.cfg["typesetter"].get("text_color", [0, 0, 0])),
                stroke_color=tuple(self.cfg["typesetter"].get("stroke_color", [255, 255, 255])),
                stroke_width=self.cfg["typesetter"].get("stroke_width", 2),
            )
        return self._typesetter

    @property
    def colorizer(self) -> MangaColorizer:
        if self._colorizer is None:
            self._colorizer = MangaColorizer(
                comfyui_url=self.cfg["comfyui"]["base_url"],
                models=self.cfg["comfyui"]["models"],
                cfg=self.cfg["comfyui"],
            )
        return self._colorizer

    def extract_page_items(self, img_path: Union[str, Path]) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """Extract all dialogue items with verified bounding boxes from page."""
        img_path = Path(img_path)
        img = imread_unicode(img_path)
        h, w = img.shape[:2]

        detections = self.detector.detect(img)
        if not detections:
            return img, []

        raw_boxes = [d.box for d in detections]
        order = sort_reading_order(raw_boxes)
        sorted_detections = [detections[i] for i in order]

        items = []
        for det_idx, det in enumerate(sorted_detections, 1):
            x1, y1, x2, y2 = pad_box(det.box, pad=4, max_w=w, max_h=h)
            crop = img[y1:y2, x1:x2]
            text = self.ocr.recognize(crop)
            if len(text.strip()) > 0:
                items.append({
                    "id": det_idx,
                    "page": img_path.name,
                    "order": det_idx,
                    "box": [int(v) for v in det.box],
                    "padded_box": [int(v) for v in (x1, y1, x2, y2)],
                    "cls": det.cls_name,
                    "conf": round(det.conf, 2),
                    "original": text,
                    "text": text,
                })
        return img, items

    def process_page(
        self,
        img_path: Union[str, Path],
        output_path: Union[str, Path],
        reference: Optional[Union[str, Path]] = None,
        mode: Optional[str] = None,
        qa_path: Optional[Union[str, Path]] = None,
        json_path: Optional[Union[str, Path]] = None,
        pre_translated_items: Optional[List[Dict[str, Any]]] = None,
        color_mode: str = "composite",
    ) -> Dict[str, Any]:
        """Process a single manga page with positional JSON integrity."""
        img_path = Path(img_path)
        output_path = Path(output_path)
        target_mode = (mode or self.cfg["pipeline"].get("mode", "auto")).lower()
        t0 = time.time()

        # Pure colorization does not need bubble detection/OCR; loading the page
        # directly saves a large amount of time on single-page GUI runs.
        fast_colorize = target_mode == "colorize"
        if fast_colorize:
            img = imread_unicode(img_path)
            if img is None:
                raise FileNotFoundError(f"Cannot read image: {img_path}")
            ocr_items = []
        else:
            img, ocr_items = self.extract_page_items(img_path)
        h, w = img.shape[:2]

        is_bw, chroma_score = ContentInspector.is_grayscale_manga(img)
        if fast_colorize:
            extracted_texts = []
            needs_translation, detected_lang = False, "unknown"
        else:
            extracted_texts = [it["original"] for it in ocr_items]
            needs_translation, detected_lang = ContentInspector.is_non_chinese(extracted_texts)
        needs_color = is_bw

        if target_mode == "auto":
            if needs_translation and needs_color:
                exec_action = "advanced"
            elif needs_translation and not needs_color:
                exec_action = "translate"
            elif not needs_translation and needs_color:
                exec_action = "colorize"
            else:
                exec_action = "none"
        elif target_mode in ("advanced", "both"):
            exec_action = "advanced"
        elif target_mode == "translate":
            exec_action = "translate"
        elif target_mode == "colorize":
            exec_action = "colorize"
        else:
            exec_action = "advanced"

        print(f"[{img_path.name}] Mode={target_mode} -> Action={exec_action} (is_bw={is_bw}, lang={detected_lang}, bubbles={len(ocr_items)})")

        ref_file = reference or self.cfg["pipeline"].get("reference")
        intermediate_dir = output_path.parent / "intermediate"
        if self.cfg["pipeline"].get("save_intermediate", True):
            intermediate_dir.mkdir(parents=True, exist_ok=True)

        final_img = img.copy()
        inpainted_bw = None

        # Translate using positional JSON if required
        verified_items = pre_translated_items
        if verified_items is None and json_path and Path(json_path).is_file():
            try:
                cached_data = json.loads(Path(json_path).read_text(encoding="utf-8"))
                verified_items = cached_data.get("bubbles")
            except Exception:
                verified_items = None

        if verified_items is None and ocr_items and exec_action in ("translate", "advanced"):
            context = f"单页漫画翻译：{img_path.name}。请根据语境和画面阅读顺序进行自然贴切的汉化。"
            verified_items = self.translator.translate_items(ocr_items, context_hint=context)
        elif verified_items is None:
            verified_items = ocr_items

        if exec_action == "none":
            final_img = img

        elif exec_action == "translate":
            if verified_items:
                inpaint_boxes = [it["padded_box"] for it in verified_items]
                inpainted_bw = self.inpainter.inpaint_bubbles(img, inpaint_boxes)
                final_img = inpainted_bw.copy()
                for it in verified_items:
                    final_img = self.typesetter.typeset_bubble(
                        final_img,
                        box=it["box"],
                        text=it.get("translation", it.get("original", "")),
                        orientation=self.cfg["typesetter"].get("vertical", "auto"),
                    )

        elif exec_action == "colorize":
            final_img = self.colorizer.colorize(img, reference_path_or_bgr=ref_file, color_mode=color_mode)

        elif exec_action == "advanced":
            # 1. Inpaint text on B&W line art
            if verified_items:
                inpaint_boxes = [it["padded_box"] for it in verified_items]
                inpainted_bw = self.inpainter.inpaint_bubbles(img, inpaint_boxes)
                if self.cfg["pipeline"].get("save_intermediate", True):
                    imwrite_unicode(intermediate_dir / f"{img_path.stem}_text_free_bw.png", inpainted_bw)
                target_to_colorize = inpainted_bw
            else:
                target_to_colorize = img

            # 2. Colorize text-free B&W image
            colorized_text_free = self.colorizer.colorize(
                target_to_colorize,
                reference_path_or_bgr=ref_file,
                color_mode=color_mode,
            )

            if self.cfg["pipeline"].get("save_intermediate", True):
                imwrite_unicode(intermediate_dir / f"{img_path.stem}_colorized_text_free.png", colorized_text_free)

            # 3. Typeset verified Chinese translations on top
            final_img = colorized_text_free.copy()
            for it in verified_items:
                final_img = self.typesetter.typeset_bubble(
                    final_img,
                    box=it["box"],
                    text=it.get("translation", it.get("original", "")),
                    orientation=self.cfg["typesetter"].get("vertical", "auto"),
                )

        imwrite_unicode(output_path, final_img)

        if json_path:
            json_p = Path(json_path)
            json_p.parent.mkdir(parents=True, exist_ok=True)
            meta = {
                "page": img_path.name,
                "action": exec_action,
                "is_bw": is_bw,
                "chroma_score": chroma_score,
                "detected_lang": detected_lang,
                "width": w,
                "height": h,
                "bubbles": verified_items,
                "seconds": round(time.time() - t0, 2),
            }
            json_p.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

        if qa_path:
            qa_p = Path(qa_path)
            qa_p.parent.mkdir(parents=True, exist_ok=True)
            target_h = 1200
            def scale_img(im):
                sc = target_h / float(im.shape[0])
                return cv2.resize(im, (int(im.shape[1] * sc), target_h), interpolation=cv2.INTER_AREA)

            sep = np.full((target_h, 10, 3), 255, dtype=np.uint8)
            panels = [scale_img(img)]
            if inpainted_bw is not None:
                panels.append(scale_img(inpainted_bw))
            panels.append(scale_img(final_img))
            
            row = np.hstack([panels[0], sep, panels[1] if len(panels) == 3 else panels[-1]])
            if len(panels) == 3:
                row = np.hstack([panels[0], sep, panels[1], sep, panels[2]])

            imwrite_unicode(qa_p, row, [cv2.IMWRITE_JPEG_QUALITY, 90])

        elapsed = time.time() - t0
        print(f"[{img_path.name}] Completed in {elapsed:.1f}s -> {output_path.name}")
        return {
            "page": img_path.name,
            "action": exec_action,
            "bubbles": len(verified_items),
            "seconds": round(elapsed, 2),
            "output": str(output_path),
        }

    def _process_colorize_batches(
        self,
        pages: List[Path],
        out_p: Path,
        reference: Optional[Union[str, Path]],
        qa_dir: Optional[Path],
        json_dir: Optional[Path],
        color_mode: str,
        force: bool,
        t_batch_start: float,
    ) -> List[Dict[str, Any]]:
        """Fast colorize-only path: no OCR/detection; batch 2 pages per prompt."""
        batch_size = int(self.cfg["pipeline"].get("color_batch_size", 2))
        batch_size = max(1, batch_size)

        pending: List[Tuple[Path, np.ndarray]] = []
        summary: List[Dict[str, Any]] = []
        for idx, page in enumerate(pages, 1):
            out_file = out_p / f"{page.stem}.png"
            if not force and out_file.is_file():
                print(f"  [{idx}/{len(pages)}] Skipping existing: {page.name}")
                continue
            img = imread_unicode(page)
            if img is None:
                print(f"  [{idx}/{len(pages)}] Cannot read image: {page}")
                summary.append({"page": page.name, "status": "error: cannot read image"})
                continue
            pending.append((page, img))

        if not pending:
            print("All pages are already processed. Exiting.")
            return []

        # ImageBatch needs equal dimensions.  018 is a double-page spread, so it
        # naturally forms its own single-image batch.
        groups: Dict[Tuple[int, int], List[Tuple[Path, np.ndarray]]] = {}
        for page, img in pending:
            groups.setdefault(img.shape[:2], []).append((page, img))

        ref_file = reference or self.cfg["pipeline"].get("reference")
        total_batches = sum((len(items) + batch_size - 1) // batch_size for items in groups.values())
        batch_no = 0

        for shape, items in groups.items():
            for start in range(0, len(items), batch_size):
                batch = items[start:start + batch_size]
                batch_no += 1
                stems = " + ".join(p.stem for p, _ in batch)
                print(f"\n[Color batch {batch_no}/{total_batches}] {stems} ({shape[1]}x{shape[0]})")
                batch_start = time.time()
                try:
                    colored = self.colorizer.colorize_batch(
                        [img for _, img in batch],
                        reference_path_or_bgr=ref_file,
                        prefix=f"mangashot_{int(time.time())}_{batch_no:03d}",
                        color_mode=color_mode,
                        page_names=[p.stem for p, _ in batch],
                    )
                except Exception as e:
                    elapsed = time.time() - batch_start
                    print(f"[Color batch {batch_no}/{total_batches}] FAILED after {elapsed:.1f}s: {e}")
                    for page, _ in batch:
                        summary.append({"page": page.name, "status": f"error: {e}"})
                    continue

                elapsed = time.time() - batch_start
                per_page = elapsed / max(1, len(batch))
                print(f"[Color batch {batch_no}/{total_batches}] done in {elapsed / 60:.1f} min "
                      f"({per_page:.1f}s/page)")

                for (page, original), final_img in zip(batch, colored):
                    out_file = out_p / f"{page.stem}.png"
                    imwrite_unicode(out_file, final_img)
                    h, w = original.shape[:2]

                    if json_dir:
                        json_file = json_dir / f"{page.stem}.json"
                        json_file.parent.mkdir(parents=True, exist_ok=True)
                        try:
                            is_bw, chroma_score = ContentInspector.is_grayscale_manga(original)
                        except Exception:
                            is_bw, chroma_score = True, 0.0
                        meta = {
                            "page": page.name,
                            "action": "colorize",
                            "is_bw": is_bw,
                            "chroma_score": chroma_score,
                            "detected_lang": "unknown",
                            "width": w,
                            "height": h,
                            "bubbles": [],
                            "seconds": round(per_page, 2),
                            "batch_seconds": round(elapsed, 2),
                            "output": str(out_file),
                        }
                        json_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

                    if qa_dir:
                        qa_file = qa_dir / f"{page.stem}_compare.jpg"
                        qa_file.parent.mkdir(parents=True, exist_ok=True)
                        target_h = 1200
                        def _thumb(im: np.ndarray) -> np.ndarray:
                            sc = target_h / float(im.shape[0])
                            return cv2.resize(im, (max(1, int(im.shape[1] * sc)), target_h),
                                              interpolation=cv2.INTER_AREA)
                        sep = np.full((target_h, 10, 3), 255, dtype=np.uint8)
                        row = np.hstack([_thumb(original), sep, _thumb(final_img)])
                        imwrite_unicode(qa_file, row, [cv2.IMWRITE_JPEG_QUALITY, 90])

                    summary.append({
                        "page": page.name,
                        "action": "colorize",
                        "bubbles": 0,
                        "seconds": round(per_page, 2),
                        "batch_seconds": round(elapsed, 2),
                        "output": str(out_file),
                        "status": "success",
                    })

        total_time = time.time() - t_batch_start
        (out_p / "summary.json").write_text(
            json.dumps({
                "total_pages": len(pending),
                "elapsed_seconds": round(total_time, 1),
                "color_batch_size": batch_size,
                "pages": summary,
            }, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nColorization finished in {total_time / 60:.1f} minutes! "
              f"Summary saved to {out_p / 'summary.json'}")
        return summary

    def process_batch(
        self,
        input_dir: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        reference: Optional[Union[str, Path]] = None,
        mode: Optional[str] = None,
        glob_pattern: str = "*.jpg",
        force: bool = False,
        page_range: Optional[str] = None,
        color_mode: str = "composite",
        explicit_pages: Optional[List[Union[str, Path]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Whole-Chapter / Batch Coordinator for MangaShot:
        Extracts all dialogue across chapter, performs narrative-coherent translation,
        and coordinates inpainting, colorization, and typesetting.

        When ``explicit_pages`` is provided, exactly those image files are
        processed (used by the GUI's discrete image picker and cross-directory
        page groups).  Otherwise the directory is scanned with ``glob_pattern``
        and filtered by ``page_range``.
        """
        import re
        in_p = Path(input_dir)
        out_p = Path(output_dir or self.cfg["pipeline"]["output_dir"])
        out_p.mkdir(parents=True, exist_ok=True)
        qa_dir = out_p / "qa" if self.cfg["pipeline"].get("save_qa", True) else None
        json_dir = out_p / "json" if self.cfg["pipeline"].get("save_json", True) else None

        if explicit_pages:
            pages = []
            seen = set()
            for raw in explicit_pages:
                p = Path(raw)
                if not p.is_absolute():
                    candidate = in_p / p
                    p = candidate if candidate.is_file() else p
                if p.is_file():
                    key = str(p.resolve()).lower()
                    if key not in seen:
                        seen.add(key)
                        pages.append(p)
            # Keep a stable, natural reading order for explicitly selected pages.
            def _sort_key(p: Path):
                nums = tuple(int(n) for n in re.findall(r"\d+", p.stem))
                return (0, nums, p.name.lower()) if nums else (1, (), p.name.lower())

            pages.sort(key=_sort_key)
        else:
            pages = sorted([p for p in in_p.glob(glob_pattern) if p.is_file()])
            if not pages:
                pages = sorted([p for p in in_p.glob("*.*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])

        # Filter by page_range (supports "03-19", discrete "01, 05, 08-15", or "*")
        if not explicit_pages and page_range and page_range.strip() != "*":
            try:
                allowed_nums = set()
                for token in re.split(r"[,，\s]+", page_range.strip()):
                    if not token:
                        continue
                    if "-" in token:
                        s_str, e_str = token.split("-")
                        for n in range(int(s_str), int(e_str) + 1):
                            allowed_nums.add(n)
                    else:
                        allowed_nums.add(int(token))
                if allowed_nums:
                    filtered = []
                    for p in pages:
                        nums = re.findall(r"\d+", p.stem)
                        if nums and int(nums[-1]) in allowed_nums:
                            filtered.append(p)
                    if filtered:
                        pages = filtered
                        print(f"Filtered pages by pattern [{page_range}]: {len(pages)} pages matched.")
            except Exception as e:
                print(f"[Warning] Failed to parse page_range '{page_range}': {e}")

        target_mode = (mode or self.cfg["pipeline"].get("mode", "auto")).lower()
        print(f"=== MangaShot Whole-Chapter Pipeline ===")
        print(f"Pages: {len(pages)} in {in_p} -> {out_p} (mode={target_mode})")
        t_batch_start = time.time()

        # Fast path: pure colorization does not need bubble detection, OCR,
        # translation or inpainting.  Batch 2 pages per ComfyUI sampler run
        # exactly like MangaColour's --batch-size 2 path.
        if target_mode == "colorize":
            return self._process_colorize_batches(
                pages=pages,
                out_p=out_p,
                reference=reference,
                qa_dir=qa_dir,
                json_dir=json_dir,
                color_mode=color_mode,
                force=force,
                t_batch_start=t_batch_start,
            )

        pages_to_process = []
        all_chapter_items: List[Dict[str, Any]] = []
        page_item_map: Dict[str, List[Dict[str, Any]]] = {}
        global_id_counter = 1

        for idx, page in enumerate(pages, 1):
            out_file = out_p / f"{page.stem}.png"
            if not force and out_file.is_file():
                print(f"  [{idx}/{len(pages)}] Skipping existing: {page.name}")
                continue

            pages_to_process.append(page)
            json_file = json_dir / f"{page.stem}.json" if json_dir else None
            if json_file and json_file.is_file():
                try:
                    c_meta = json.loads(json_file.read_text(encoding="utf-8"))
                    cached_items = c_meta.get("bubbles", [])
                    if cached_items:
                        page_item_map[page.name] = cached_items
                        print(f"  [{idx}/{len(pages)}] {page.name}: loaded {len(cached_items)} cached dialogue items.")
                        continue
                except Exception:
                    pass

            _, items = self.extract_page_items(page)
            for it in items:
                it["global_id"] = global_id_counter
                it["id"] = global_id_counter
                global_id_counter += 1
                all_chapter_items.append(it)
            print(f"  [{idx}/{len(pages)}] {page.name}: {len(items)} dialogue bubbles extracted.")

        if not pages_to_process:
            print("All pages are already processed. Exiting.")
            return []

        # Whole-chapter translation if translation is needed
        if all_chapter_items and target_mode in ("auto", "advanced", "both", "translate"):
            print(f"\nTranslating {len(all_chapter_items)} items with global chapter context...")
            chapter_context = (
                f"日漫章节全篇连贯翻译：共 {len(pages_to_process)} 页，包含 {len(all_chapter_items)} 处台词。\n"
                "统筹理解全话剧情起伏、对话来回交锋与角色情感关系，确保全书人称、敬语、口癖与专有名词完全统一连贯。"
            )
            translated_items = self.translator.translate_items(
                all_chapter_items,
                context_hint=chapter_context,
                max_chunk_size=35,
            )
            for it in translated_items:
                page_item_map.setdefault(it.get("page", ""), []).append(it)

        # Process each page
        summary = []
        for idx, page in enumerate(pages_to_process, 1):
            out_file = out_p / f"{page.stem}.png"
            qa_file = qa_dir / f"{page.stem}_compare.jpg" if qa_dir else None
            json_file = json_dir / f"{page.stem}.json" if json_dir else None

            pre_items = page_item_map.get(page.name)
            try:
                res = self.process_page(
                    img_path=page,
                    output_path=out_file,
                    reference=reference,
                    mode=target_mode,
                    qa_path=qa_file,
                    json_path=json_file,
                    pre_translated_items=pre_items,
                    color_mode=color_mode,
                )
                res["status"] = "success"
                summary.append(res)
            except Exception as e:
                print(f"[{idx}/{len(pages_to_process)}] Error on {page.name}: {e}")
                summary.append({"page": page.name, "status": f"error: {e}"})

        total_time = time.time() - t_batch_start
        (out_p / "summary.json").write_text(
            json.dumps({"total_pages": len(pages_to_process), "elapsed_seconds": round(total_time, 1), "pages": summary}, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"\nBatch processing finished in {total_time / 60:.1f} minutes! Summary saved to {out_p / 'summary.json'}")
        return summary
