#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Unified CLI for MangaShot:
One-Click Manga Translation & Colorization Pipeline.
"""
import argparse
import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from mangashot.pipeline import MangaShotPipeline
from mangashot.utils import deep_merge


def main():
    parser = argparse.ArgumentParser(
        description="MangaShot: One-Click Japanese Manga Translation & Colorization Pipeline"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to an input image file or a directory containing manga pages."
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output directory (default: outputs/)"
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["auto", "advanced", "both", "translate", "colorize"],
        default=None,
        help="Processing mode: 'auto' (smart detect), 'advanced' (inpaint->colorize->typeset), 'translate', 'colorize'"
    )
    parser.add_argument(
        "--reference", "-r",
        default=None,
        help="Path to color palette reference image for colorization"
    )
    parser.add_argument(
        "--config", "-c",
        default="config.example.json",
        help="Path to JSON configuration file"
    )
    parser.add_argument(
        "--api-base",
        default=None,
        help="Translation API base URL"
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Translation API key"
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Translation model name"
    )
    parser.add_argument(
        "--comfyui-url",
        default=None,
        help="ComfyUI server base URL (default: http://127.0.0.1:8000)"
    )
    parser.add_argument(
        "--device",
        choices=["cuda", "cpu"],
        default=None,
        help="Hardware compute device (default: cuda if available)"
    )
    parser.add_argument(
        "--font",
        default=None,
        help="Custom CJK TTF/TTC font path"
    )
    parser.add_argument(
        "--glob",
        default="*.jpg",
        help="File pattern when input is a directory (default: *.jpg)"
    )
    parser.add_argument(
        "--page-range",
        default=None,
        help="Range of pages to process by number, e.g. 03-19 or 3-19"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-processing of already completed pages"
    )
    parser.add_argument(
        "--contact-sheet",
        action="store_true",
        help="Generate grid contact sheet after batch processing"
    )

    args = parser.parse_args()

    cfg_override = {}
    if args.api_base:
        cfg_override.setdefault("api", {})["base_url"] = args.api_base
    if args.api_key:
        cfg_override.setdefault("api", {})["api_key"] = args.api_key
    if args.model:
        cfg_override.setdefault("api", {})["model"] = args.model
    if args.comfyui_url:
        cfg_override.setdefault("comfyui", {})["base_url"] = args.comfyui_url
    if args.device:
        cfg_override.setdefault("detector", {})["device"] = args.device
        cfg_override.setdefault("ocr", {})["device"] = args.device
    if args.font:
        cfg_override.setdefault("typesetter", {})["font_path"] = args.font
    if args.output:
        cfg_override.setdefault("pipeline", {})["output_dir"] = args.output
    if args.mode:
        cfg_override.setdefault("pipeline", {})["mode"] = args.mode
    if args.reference:
        cfg_override.setdefault("pipeline", {})["reference"] = args.reference

    pipeline = MangaShotPipeline(
        config=cfg_override,
        config_path=args.config if Path(args.config).is_file() else None,
    )

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"Error: Input path '{in_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.output or pipeline.cfg["pipeline"]["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    if in_path.is_file():
        out_file = out_dir / f"{in_path.stem}.png"
        qa_file = out_dir / "qa" / f"{in_path.stem}_compare.jpg"
        json_file = out_dir / "json" / f"{in_path.stem}.json"
        
        pipeline.process_page(
            img_path=in_path,
            output_path=out_file,
            reference=args.reference,
            mode=args.mode,
            qa_path=qa_file,
            json_path=json_file,
        )
    else:
        pipeline.process_batch(
            input_dir=in_path,
            output_dir=out_dir,
            reference=args.reference,
            mode=args.mode,
            glob_pattern=args.glob,
            force=args.force,
            page_range=args.page_range,
        )

        if args.contact_sheet:
            from scripts.make_contact_sheet import create_contact_sheet
            sheet_file = out_dir / "contact_sheet.jpg"
            create_contact_sheet(out_dir, sheet_file)


if __name__ == "__main__":
    main()
