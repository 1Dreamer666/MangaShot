**English** | [中文](README_ZH.md)

# MangaShot

**One-Click AI Japanese Manga Translation, Inpainting & Colorization Studio.**

MangaShot integrates the capabilities of **MangaTranslate** and **MangaColour** into a unified, industrial-grade manga localization pipeline. It intelligently inspects manga pages, automatically translates dialogue using OpenAI-compatible LLMs with strict **Positional JSON Protocol**, inpaints and removes original speech, and colorizes line art using ComfyUI FLUX.2—all through either an intuitive **TypeScript Web GUI** or an AI-native **`.dsh` Agent Skill**.

---

## Key Features

### 1. Smart Content Auto-Detection
- **Visual Chroma Analysis**: Measures standard deviation and 90th percentile chroma in LAB color space to determine if a page is black-and-white / grayscale (triggers colorization) or already full color.
- **Language & Kana Detection**: Performs OCR sampling on speech bubbles and checks for Hiragana/Katakana (`\u3040-\u30ff`) to detect Japanese or foreign text (triggers translation to Chinese).

### 2. Advanced Orchestration Mode (Recommended)
Standard colorization of pre-typeset pages often causes diffusion models to blur font glyphs or generate hallucinated color noise over text. MangaShot solves this with a 4-step orchestration:
1. **Detect & Translate**: Extract dialogue bubbles with YOLOv8 and Manga-OCR, then translate via Gemini with positional JSON controls.
2. **Text-Free Line Art Inpainting**: Cleanly erase Japanese characters inside bubbles while strictly protecting bubble borders using connected-component analysis.
3. **Diffusion Colorization**: Send the clean, text-free B&W page to ComfyUI FLUX.2 for reference-guided colorization and guided-filter luminance compositing.
4. **Sharp Vector Re-Typesetting**: Overlay the verified Chinese translation directly on top of the newly colorized image with anti-aliasing contrast strokes. **Font outlines remain 100% vector-sharp with zero diffusion artifacts!**

### 3. Colorization Modes: Composite vs Direct
MangaShot provides two colorization modes configurable via `--color-mode`:
- **`composite` (Default & Highly Recommended)**:
  Inherits and enhances MangaColour's core postprocessing. Preserves the full-resolution 2000px line art as the LAB luminance ($L$) channel, guided-filtering the predicted $a/b$ chroma from FLUX.2, and applying `white_threshold=256.0` to whiten speech bubbles and clean pure paper. Eliminates diffusion blurring, hallucinated text, and color stains inside bubbles.
- **`direct` (Vivid Color Mode / 浓烈色彩模式)**:
  Directly upscales the raw FLUX.2 color output without luminance composite. Produces rich, painterly diffusion textures suitable for stylized, painterly aesthetics.

### 4. Positional JSON Protocol & Whole-Chapter Coherence
- Every dialogue item is tracked with explicit spatial metadata: `{"id": 1, "page": "002.jpg", "box": [x1, y1, x2, y2], "text": "..."}`.
- When processing batches or whole manga books, dialogue streams are submitted with global chapter context, ensuring recurring characters, pronouns, and conversational flow stay consistent from page to page.
- Returned JSON is strictly validated and re-anchored to ground-truth coordinates, preventing text displacement.

### 5. Dual Interaction Modes (Human & AI)
- **Human Interface**: Modern, responsive **TypeScript Web GUI** (built with React + Vite + TypeScript) served by a zero-dependency Python backend at `http://127.0.0.1:7860`.
- **AI Agent Skill**: Ready-to-use **`.dsh` Skill** (`.dsh/skills/manga-shot/SKILL.md`) with automated junction linking at workspace root for autonomous execution.

### 6. Tuned FLUX.2 Defaults (6 GB VRAM)
The checked-in defaults are the measured optimum for the bundled `manga_colorization` LoRA on a 6 GB RTX 3060:

| Setting | Default | Rationale |
|---|---:|---|
| `comfyui.steps` | `2` | 1 step is fastest but visibly pale; 3–5 steps wash out further and cost 45–140% more time. |
| `comfyui.cfg` | `1.0` | Guidance-free: halves U-Net sampling passes, avoids negative prompt overhead, and removes cyan/magenta fringing in highlights. |
| `comfyui.megapixels` | `0.5` | Keeps the 9B model inside 6 GB while retaining enough chroma detail. |
| `pipeline.color_batch_size` | `3` | Measured sweet spot on 6 GB VRAM (~5.6 GB peak); steady-state throughput reaches 13.8 s / page. |
| `comfyui.prompt` | `mngclranm` | LoRA trigger. An empty prompt degrades toward gray/white. |
| `comfyui.postprocess.sat` | `1.3` | AB backfill discards the model's L channel; 1.3 restores warm skin without yellowing paper. |
| `comfyui.postprocess.white_threshold` | `256.0` | Protects pure paper and bubble whites. |
| `--color-mode` | `composite` | Keeps original line art and text sharp; `direct` is only for painterly experiments. |

Do not "improve" quality by raising steps: on this LoRA, 4–5 steps converge to a colder, whiter palette. Keep the trigger word in the prompt. Measured timings at 0.5 MP / batch 3 (steady state with cfg=1.0): ~13.8 s / page (~41.4 s per 3-page batch).

#### ComfyUI Startup Flags for 6 GB GPUs
Launch ComfyUI with:
```powershell
python main.py --base-directory "C:\NEED_FOR_SYSTEM_CHR" `
  --extra-model-paths-config "config/extra_model_paths.yaml" `
  --port 8000 --disable-auto-launch --fp16-vae
```
- **Recommended**: `--fp16-vae` lowers VAE memory peak cleanly with zero visual degradation.
- **Do NOT use `--highvram`**: 6 GB cannot fit both the 6.5 GB text encoder and 4.7 GB diffusion model simultaneously. Forcing `--highvram` causes severe PCIe virtual memory swapping, slowing sampling from 7 s/step to over 700 s/step.
- **Do NOT use `--use-split-cross-attention`**: breaks PyTorch 2.x SDPA attention optimization, reduces GPU resident weights to 0 MB, and increases GPU idle percentage.
- **Do NOT use `--vram-headroom`**: evicts diffusion layers to system RAM, causing GPU utilization to collapse to ~20%.
- **Two-stage workflow (fastest)**: run `shot.py -m translate` on the full chapter dialogue first (CPU/API bound, creates clean text-free bases and coherent translations), then run `colorize_cached.py --batch-size 3 --cfg 1.0` for pure, uninterrupted GPU colorization.

### 7. Sharp CJK Typesetting with Symbol Fallback
- Microsoft YaHei / SimHei cover Chinese but not common manga symbols such as `♡`, `♥`, `♦`, `♣`, `♠`, `♪`, `♬`, `✕`, or `❤`.
- `MangaTypesetter` now renders those characters with a per-character fallback font (Segoe UI Symbol on Windows; DejaVu Sans / Noto Symbols on Linux) while keeping Chinese text in the configured CJK font.
- Horizontal lines are split into font runs so contrast strokes do not create seams; vertical columns select the fallback font per glyph.
- This prevents tofu boxes (`口`) in bubbles such as `嘿♡嘿♡` or `啊♥`.

### 8. GUI Batch Workflow
The TypeScript GUI supports:
- **Multi-chapter queue**: add, clone, or delete chapter cards; run them sequentially; keep a per-chapter reference image.
- **Discrete page selection**: pick individual pages or cross-directory groups; explicit selections take precedence over the page-range filter.
- **Native pickers**: system file/directory dialogs with a browser fallback.
- **Title inference**: an OpenAI-compatible LLM extracts the series title for `outputs/<series>/<chapter>/`; the queue sends the chapter name explicitly.
- **Batch API**: `POST /api/batch` accepts `selected_files` and `extra_groups`, preserves natural page order, and honors `force`.

### 9. Cached Re-Color and Typeset-Only Fixes
- `scripts/colorize_cached.py` re-colors cached text-free pages (`<stem>_text_free_bw.png`) and re-typesets cached translations without re-running detection, OCR, or translation:
  ```powershell
  python scripts/colorize_cached.py --pages 006,007 --force
  ```
  Defaults: `steps=2`, `cfg=1.0`, `sat=1.3`, `prompt=mngclranm`, batch 3.
- When only typesetting needs a fix (for example, a missing symbol), do **not** re-colorize. The advanced pipeline saves `intermediate/<stem>_colorized_text_free.png` and `json/<stem>.json`; reload the colorized text-free background and re-run `MangaTypesetter` on the cached bubbles. This is CPU-only and leaves the colorization pixel-identical.

---

## Repository Structure

```text
.
├── .dsh/                    # AI Agent Skill definitions
│   └── skills/manga-shot/
│       └── SKILL.md         # Complete skill execution manual for dsh agent
├── .gitignore               # Strictly excludes models/, outputs/, inputs/, .cache/, node_modules/
├── LICENSE                  # AGPL-3.0
├── README.md                # English documentation
├── README_ZH.md             # Chinese documentation
├── requirements.txt         # Core Python dependencies
├── config.example.json      # Pipeline configuration template
├── config/
│   └── extra_model_paths.yaml # ComfyUI model path definitions
├── mangashot/               # Core Python package
│   ├── __init__.py
│   ├── inspector.py         # Visual chroma & language auto-detection
│   ├── detector.py          # YOLOv8 comic bubble & text detector
│   ├── ocr.py               # Manga-OCR wrapper (safetensors + CUDA)
│   ├── translator.py        # Positional JSON Gemini client with caching & retries
│   ├── inpainter.py         # Boundary-safe connected component text removal
│   ├── typesetter.py        # CJK layout, font fitting, and symbol fallback
│   ├── postprocess.py       # Guided Filter L-channel line art composite
│   ├── colorizer.py         # ComfyUI FLUX.2 client & execution engine
│   ├── pipeline.py          # Unified pipeline orchestrator
│   ├── titles.py            # LLM-based series/chapter title inference
│   └── utils.py             # Unicode image IO, geometry, and config utilities
├── scripts/
│   ├── shot.py              # Primary CLI interface (single page / batch)
│   ├── server.py            # Lightweight Python server hosting TypeScript GUI
│   ├── colorize_cached.py   # Re-color cached text-free pages and re-typeset
│   ├── native_picker.py     # Native file/directory picker for the GUI
│   ├── simulate_gui_run.py  # Headless GUI/API batch simulation helper
│   ├── check_setup.py       # Comprehensive diagnostic check
│   ├── download_models.ps1  # Automated model downloader & link helper
│   └── make_contact_sheet.py# Grid contact sheet compiler
├── gui/                     # TypeScript Web GUI
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/                 # React + TypeScript frontend components
│   └── dist/                # Pre-built production frontend assets
└── examples/
    └── sample_reference.jpg # Sample color palette reference image
```

---

## Quick Start

### 1. Install Dependencies
```powershell
python -m pip install -r requirements.txt
```

### 2. Setup Models
```powershell
.\scripts\download_models.ps1
```
*(Automatically links existing models from MangaColour and MangaTranslate if present locally, avoiding duplicate 12GB downloads).*

### 3. Run Diagnostic Check
```powershell
python scripts/check_setup.py --config config.example.json
```

### 4. Option A: Launch TypeScript Web GUI (For Humans)
```powershell
python scripts/server.py --port 7860
```
Open your browser at `http://127.0.0.1:7860` to access the full-featured visual studio.

### 5. Option B: Run via CLI or .dsh Skill (For AI & CLI)

**Single Page (Advanced Mode)**:
```powershell
python scripts/shot.py `
  --input "path/to/page.jpg" `
  --output "outputs/single" `
  --mode advanced `
  --reference "examples/sample_reference.jpg"
```

**Batch Directory / Whole Manga Chapter**:
```powershell
python scripts/shot.py `
  --input "path/to/manga_chapter/" `
  --output "outputs/chapter_01" `
  --mode auto `
  --reference "examples/sample_reference.jpg" `
  --glob "*.jpg" `
  --contact-sheet
```

---

## Pipeline Execution Modes

| Mode | Behavior | Description |
|---|---|---|
| `auto` | Auto-detects Chroma & Language | Colorizes if B&W, translates if non-Chinese. Triggers `advanced` if both. |
| `advanced` | Inpaint -> Colorize -> Typeset | Erases Japanese text from B&W line art, colorizes text-free image, then overlays vector-sharp Chinese. |
| `both` | Translate + Colorize | Executes both translation and colorization unconditionally. |
| `translate`| Translation Only | Performs bubble detection, OCR, Gemini translation, inpainting, and typesetting. |
| `colorize` | Colorization Only | Performs reference-guided FLUX.2 colorization with guided filter L-channel preservation. |

---

## Configuration & Tuning Notes

- `config.example.json` is loaded when `scripts/server.py` starts. Restart the server after changing `steps`, `sat`, `prompt`, or model paths.
- `steps=2` is intentional. 1 step is too pale; 3–5 steps are slower and colder. Keep `prompt="mngclranm"`; empty prompts turn pages gray.
- `postprocess.sat=1.3` applies only to `composite` mode. It compensates for the AB backfill's discarded L channel; raising it further can over-saturate clothing and backgrounds.
- `pipeline.color_batch_size=3` and `comfyui.cfg=1.0` are the 6 GB sweet spot (measured ~5.6 GB VRAM peak). Pages with different dimensions (for example, double-page spreads) are automatically split into separate batches.
- The server reads the example config by default (`config_path="config.example.json"`). Keep local secrets and user manga pages out of the tracked config and `inputs/`.
- For typeset-only fixes, reuse `intermediate/<stem>_colorized_text_free.png` and `json/<stem>.json`; re-colorizing is unnecessary and would change the GPU output.

---

## Troubleshooting

- **ComfyUI returns `OSError: [Errno 22] Invalid argument` from tqdm**: the server inherited a dead stdout pipe. Restart ComfyUI with stdout/stderr redirected to log files; do not change sampler steps to work around it.
- **Colorized pages look gray/white**: confirm `prompt` contains `mngclranm` (an empty prompt degrades to gray) and `postprocess.sat` is `1.3` for composite mode.
- **`♡` / `♥` / `♦` render as `口`**: the selected CJK font lacks the glyph. Keep the symbol fallback font available (`seguisym.ttf` on Windows) or extend `MangaTypesetter.SYMBOL_FALLBACK_CHARS`.
- **GUI shows ComfyUI offline**: start ComfyUI on the configured `comfyui.base_url` before queuing a colorization job; the health chip is advisory and the batch will fail per page if the service is down.

---

## License

- Code in this repository is licensed under **AGPL-3.0** (see `LICENSE`).
