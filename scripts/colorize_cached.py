# -*- coding: utf-8 -*-
"""Re-colorize cached text-free pages and re-typeset cached translations.

This is the "cheap re-color" path: when an earlier advanced run already
produced ``<page>_text_free_bw.png`` (text erased) and a translation JSON, we
can skip detection/OCR/inpaint/translation and only redo the GPU-heavy part:

    1. FLUX.2 colorization on the text-free B&W base (batch 2 pages).
    2. AB-channel backfill: keep the base's L channel, take A/B from the model
       (``composite_chroma``), so line art stays crisp at full resolution.
    3. Re-typeset the cached Chinese translations on top.

Defaults are the tuned optimum for this LoRA on 6 GB VRAM:
``steps=2``, ``megapixels=0.5``, batch 2 pages, trigger prompt
``mngclranm``, and ``sat=1.3`` for the AB backfill.  1 step was rejected
as too pale; 3-5 steps only washed the colors out further.

Example:
    python scripts/colorize_cached.py --pages 003,005
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import cv2
import numpy as np

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from mangashot.colorizer import MangaColorizer
from mangashot.typesetter import MangaTypesetter
from mangashot.utils import imread_unicode, imwrite_unicode

DEFAULT_REFERENCE = REPO / "inputs" / "7643-[のりんこ (のりんこ)]" / "作者参照.png"


def parse_page_numbers(raw: str) -> List[int]:
    """Parse '003,005' or '03-19' into a sorted list of page numbers."""
    numbers = set()
    for token in re.split(r"[,，\s]+", raw.strip()):
        if not token:
            continue
        if "-" in token:
            start, end = token.split("-", 1)
            numbers.update(range(int(start), int(end) + 1))
        else:
            numbers.add(int(token))
    return sorted(numbers)


def stem_for(page_no: int) -> str:
    return f"MOMOUMIX_{page_no:03d}"


def build_colorizer(steps: int, megapixels: float, timeout: int, sat: float,
                    prompt: str, negative: str) -> MangaColorizer:
    return MangaColorizer(
        comfyui_url="http://127.0.0.1:8000",
        models={
            "unet": "FLUX.2/flux-2-klein-base-9b-Q3_K_M.gguf",
            "clip": "Qwen/qwen_3_8b_fp4mixed.safetensors",
            "vae": "FLUX.2/flux2-vae.safetensors",
            "lora": "FLUX.2/manga_colorization.safetensors",
        },
        cfg={
            "megapixels": megapixels,
            "resolution_steps": 16,
            "steps": steps,
            "cfg": 4.0,
            "seed": 1234,
            "lora_strength": 1.0,
            "prompt": prompt,
            "negative": negative,
            "timeout": timeout,
            "postprocess": {
                "radius": 2,
                "sat": sat,
                "white_threshold": 256.0,
                "neutral_mask": False,
            },
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Re-colorize cached text-free manga pages.")
    parser.add_argument("--pages", required=True, help="e.g. 003,005 or 03-19")
    parser.add_argument("--intermediate", default=str(REPO / "outputs" / "gui_batch" / "intermediate"),
                        help="Directory containing <stem>_text_free_bw.png")
    parser.add_argument("--json-dir", default=str(REPO / "outputs" / "gui_batch" / "json"),
                        help="Directory containing cached <stem>.json translations")
    parser.add_argument("--output-dir", default=str(REPO / "outputs" / "少女与战车" / "第 01 话"),
                        help="Directory for final typeset PNGs")
    parser.add_argument("--reference", default=str(DEFAULT_REFERENCE))
    parser.add_argument("--steps", type=int, default=2)
    parser.add_argument("--megapixels", type=float, default=0.5)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--sat", type=float, default=1.3,
                        help="AB chroma multiplier; 1.3 compensates for pale skin after AB backfill")
    parser.add_argument("--prompt", default="mngclranm",
                        help="Positive prompt; mngclranm is the LoRA trigger word")
    parser.add_argument("--negative", default="",
                        help="Negative prompt")
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument("--no-typeset", action="store_true", help="Only colorize, skip cached text")
    parser.add_argument("--force", action="store_true", help="Overwrite final PNGs if present")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    intermediate_dir = Path(args.intermediate)
    json_dir = Path(args.json_dir)
    reference = Path(args.reference)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_intermediate = output_dir / "intermediate"
    qa_dir = output_dir / "qa"
    out_intermediate.mkdir(parents=True, exist_ok=True)
    qa_dir.mkdir(parents=True, exist_ok=True)

    if not reference.is_file():
        raise FileNotFoundError(f"Reference image not found: {reference}")

    colorizer = build_colorizer(args.steps, args.megapixels, args.timeout,
                                args.sat, args.prompt, args.negative)
    typesetter = MangaTypesetter(
        font_path="C:/Windows/Fonts/msyh.ttc",
        fallback_font="C:/Windows/Fonts/simhei.ttf",
        stroke_width=2,
    )

    pages: List[Tuple[str, Path, Path, List[Dict]]] = []
    for page_no in parse_page_numbers(args.pages):
        stem = stem_for(page_no)
        base = intermediate_dir / f"{stem}_text_free_bw.png"
        meta_path = json_dir / f"{stem}.json"
        if not base.is_file():
            print(f"[skip] missing text-free base: {base}")
            continue
        if not meta_path.is_file():
            print(f"[skip] missing translation JSON: {meta_path}")
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        bubbles = meta.get("bubbles") or []
        pages.append((stem, base, meta_path, bubbles))

    if not pages:
        print("No processable pages.")
        return 1

    # ImageBatch requires identical dimensions; group by shape first.
    groups: Dict[Tuple[int, int], List[Tuple[str, Path, List[Dict]]]] = {}
    images: Dict[str, np.ndarray] = {}
    for stem, base, _meta_path, bubbles in pages:
        img = imread_unicode(base)
        if img is None:
            print(f"[skip] cannot read: {base}")
            continue
        images[stem] = img
        groups.setdefault(img.shape[:2], []).append((stem, base, bubbles))

    batch_size = max(1, args.batch_size)
    total_batches = sum((len(items) + batch_size - 1) // batch_size for items in groups.values())
    batch_no = 0
    summary: List[Dict] = []

    for shape, items in groups.items():
        for start in range(0, len(items), batch_size):
            batch = items[start:start + batch_size]
            batch_no += 1
            stems = [s for s, _b, _x in batch]
            print(f"\n[Batch {batch_no}/{total_batches}] {' + '.join(stems)} ({shape[1]}x{shape[0]})", flush=True)
            t0 = time.time()
            colored = colorizer.colorize_batch(
                [images[s] for s in stems],
                reference_path_or_bgr=reference,
                prefix=f"step{args.steps}_cached",
                color_mode="composite",
                page_names=stems,
            )
            elapsed = time.time() - t0
            print(f"[Batch {batch_no}/{total_batches}] colorized in {elapsed:.1f}s "
                  f"({elapsed / len(batch):.1f}s/page)", flush=True)

            for (stem, base_path, bubbles), colorized in zip(batch, colored):
                base_img = images[stem]
                imwrite_unicode(out_intermediate / f"{stem}_colorized_base.png", colorized)

                final_img = colorized.copy()
                drawn = 0
                if not args.no_typeset:
                    for bubble in bubbles:
                        text = (bubble.get("translation") or "").strip()
                        if not text:
                            continue
                        final_img = typesetter.typeset_bubble(
                            final_img,
                            box=tuple(bubble["box"]),
                            text=text,
                            orientation="auto",
                        )
                        drawn += 1

                final_path = output_dir / f"{stem}.png"
                if final_path.is_file() and not args.force:
                    print(f"  [skip] exists: {final_path} (use --force to overwrite)")
                    continue
                imwrite_unicode(final_path, final_img)

                # QA strip: erased base | colorized base | final typeset page.
                target_h = 1000
                def thumb(im: np.ndarray) -> np.ndarray:
                    scale = target_h / float(im.shape[0])
                    return cv2.resize(im, (max(1, int(im.shape[1] * scale)), target_h),
                                      interpolation=cv2.INTER_AREA)

                sep = np.full((target_h, 8, 3), 255, dtype=np.uint8)
                strip = np.hstack([thumb(base_img), sep, thumb(colorized), sep, thumb(final_img)])
                imwrite_unicode(qa_dir / f"{stem}_step{args.steps}_compare.jpg", strip,
                                [cv2.IMWRITE_JPEG_QUALITY, 88])

                summary.append({
                    "page": f"{stem}.png",
                    "bubbles_typeset": drawn,
                    "batch_seconds": round(elapsed, 1),
                    "per_page_seconds": round(elapsed / len(batch), 1),
                    "output": str(final_path),
                })
                print(f"  -> {final_path} ({drawn} bubbles)", flush=True)

    meta_out = output_dir / f"summary_step{args.steps}.json"
    meta_out.write_text(json.dumps({
        "steps": args.steps,
        "megapixels": args.megapixels,
        "batch_size": batch_size,
        "sat": args.sat,
        "prompt": args.prompt,
        "negative": args.negative,
        "reference": str(reference),
        "pages": summary,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone. Summary: {meta_out}")
    print("RESULT_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
