#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Environment and component diagnostics for MangaShot.
Checks Python packages, CUDA, local models, font accessibility, Translation API, and ComfyUI.
"""
import argparse
import json
import sys
from pathlib import Path
import requests

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))


def check_env(config_path: str = "config.example.json"):
    print("==================================================")
    print("        MangaShot Setup Diagnostic Check          ")
    print("==================================================")
    all_ok = True

    # 1. Python & Core packages
    print("\n[1] Checking Python Environment & Dependencies:")
    print(f"  Python version: {sys.version.split()[0]}")
    
    deps = [
        ("torch", "PyTorch"),
        ("torchvision", "TorchVision"),
        ("cv2", "OpenCV"),
        ("PIL", "Pillow"),
        ("numpy", "NumPy"),
        ("ultralytics", "Ultralytics YOLO"),
        ("manga_ocr", "Manga-OCR"),
        ("requests", "Requests"),
    ]
    for mod_name, label in deps:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "installed")
            print(f"  OK: {label:<18} ({ver})")
        except ImportError:
            print(f"  FAIL: {label:<18} (NOT installed)")
            all_ok = False

    # 2. CUDA Acceleration
    print("\n[2] Checking CUDA / GPU Acceleration:")
    try:
        import torch
        if torch.cuda.is_available():
            dev_name = torch.cuda.get_device_name(0)
            vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"  OK: CUDA is available! Device: {dev_name} ({vram_gb:.2f} GB VRAM)")
        else:
            print("  WARN: CUDA is not available. Running on CPU.")
    except Exception as e:
        print(f"  FAIL: PyTorch CUDA check error: {e}")
        all_ok = False

    # 3. Load Config
    cfg_path = Path(config_path)
    if not cfg_path.is_file():
        cfg_path = repo_root / config_path
    
    if not cfg_path.is_file():
        print(f"\n[3] Configuration file '{config_path}' not found!")
        return False

    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

    # 4. Check Local Models
    print("\n[3] Checking Local Model Files:")
    det_model = Path(cfg["detector"]["model_path"])
    if not det_model.is_absolute():
        det_model = repo_root / det_model

    if det_model.is_file():
        print(f"  OK: Bubble Detector: {det_model.name} ({det_model.stat().st_size / 1e6:.1f} MB)")
    else:
        print(f"  FAIL: Bubble Detector missing at: {det_model}")
        all_ok = False

    ocr_model = Path(cfg["ocr"]["model_path"])
    if not ocr_model.is_absolute():
        ocr_model = repo_root / ocr_model

    if ocr_model.is_dir() and (ocr_model / "model.safetensors").is_file():
        w_size = (ocr_model / "model.safetensors").stat().st_size / 1e6
        print(f"  OK: Manga-OCR Base: {ocr_model.name} (model.safetensors, {w_size:.1f} MB)")
    else:
        print(f"  FAIL: Manga-OCR directory missing at: {ocr_model}")
        all_ok = False

    # Check ComfyUI Model files if present locally
    models_dir = repo_root / "models"
    for category in ["diffusion_models", "text_encoders", "vae", "loras"]:
        cat_dir = models_dir / category
        if cat_dir.is_dir():
            files_count = len(list(cat_dir.rglob("*.*")))
            print(f"  OK: ComfyUI {category:<16} ({files_count} files linked/present)")
        else:
            print(f"  WARN: ComfyUI {category} folder not found in models/")

    # 5. Check Font
    print("\n[4] Checking CJK Font:")
    from mangashot.typesetter import MangaTypesetter
    try:
        font_file = MangaTypesetter._resolve_font(
            cfg["typesetter"].get("font_path"),
            cfg["typesetter"].get("fallback_font")
        )
        print(f"  OK: CJK Font found: {font_file}")
    except Exception as e:
        print(f"  FAIL: CJK Font error: {e}")
        all_ok = False

    # 6. Check Translation API
    print("\n[5] Checking Translation API Connectivity:")
    base_url = cfg["api"]["base_url"].rstrip("/")
    api_key = cfg["api"]["api_key"]
    model_name = cfg["api"]["model"]
    print(f"  Endpoint: {base_url}")
    print(f"  Model:    {model_name}")

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        r = requests.get(f"{base_url}/models", headers=headers, timeout=5)
        if r.status_code == 200:
            print("  OK: Gateway reachable.")
        else:
            print(f"  FAIL: Gateway returned HTTP {r.status_code}")
            all_ok = False
    except Exception as e:
        print(f"  FAIL: Could not connect to API gateway: {e}")
        all_ok = False

    # 7. Check ComfyUI server
    print("\n[6] Checking ComfyUI Server Connectivity:")
    comfy_url = cfg["comfyui"]["base_url"].rstrip("/")
    try:
        r = requests.get(f"{comfy_url}/system_stats", timeout=2)
        if r.status_code == 200:
            print(f"  OK: ComfyUI is online at {comfy_url}")
        else:
            print(f"  WARN: ComfyUI returned HTTP {r.status_code} at {comfy_url}")
    except Exception:
        print(f"  INFO: ComfyUI is currently offline at {comfy_url}. Start ComfyUI when full-color diffusion colorization is needed.")

    print("\n==================================================")
    if all_ok:
        print("  RESULT: Core components passed! Pipeline ready.")
    else:
        print("  RESULT: Some checks failed. Review issues above.")
    print("==================================================")
    return all_ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check MangaShot setup & components.")
    parser.add_argument("--config", "-c", default="config.example.json", help="Path to config file")
    args = parser.parse_args()
    ok = check_env(args.config)
    sys.exit(0 if ok else 1)
