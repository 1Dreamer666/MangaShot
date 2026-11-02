**English** | [中文](README_ZH.md)

# MangaShot

**One-Click AI Japanese Manga Translation, Inpainting & Colorization Studio.**

MangaShot integrates the capabilities of **MangaTranslate** and **MangaColour** into a unified, industrial-grade manga localization pipeline. It intelligently inspects manga pages, automatically translates dialogue using OpenAI-compatible LLMs with strict **Positional JSON Protocol**, inprints and removes original speech, and colorizes line art using ComfyUI FLUX.2—all through either an intuitive **TypeScript Web GUI** or an AI-native **`.dsh` Agent Skill**.

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
  Inherits and enhances MangaColour's core postprocessing. Preserves the full-resolution 2000px line art as the LAB luminance ($L$) channel, guided-filtering the predicted $a/b$ chroma from FLUX.2, and applying `white_threshold=245.0` to whiten speech bubbles and clean pure paper. Eliminates diffusion blurring, hallucinated text, and color stains inside bubbles.
- **`direct` (Vivid Color Mode / 浓烈色彩模式)**:
  Directly upscales the raw FLUX.2 color output without luminance composite. Produces rich, painterly diffusion textures suitable for stylized, painterly aesthetics.

### 4. Positional JSON Protocol & Whole-Chapter Coherence
- Every dialogue item is tracked with explicit spatial metadata: `{"id": 1, "page": "002.jpg", "box": [x1, y1, x2, y2], "text": "..."}`.
- When processing batches or whole manga books, dialogue streams are submitted with global chapter context, ensuring recurring characters, pronouns, and conversational flow stay consistent from page to page.
- Returned JSON is strictly validated and re-anchored to ground-truth coordinates, preventing text displacement.

### 4. Dual Interaction Modes (Human & AI)
- **Human Interface**: Modern, responsive **TypeScript Web GUI** (built with React + Vite + TypeScript) served by a zero-dependency Python backend at `http://127.0.0.1:7860`.
- **AI Agent Skill**: Ready-to-use **`.dsh` Skill** (`.dsh/skills/manga-shot/SKILL.md`) with automated junction linking at workspace root for autonomous execution.

---

## Repository Structure

```text
.
├── .dsh/                    # AI Agent Skill definitions
│   └── skills/manga-shot/
│       └── SKILL.md         # Complete skill execution manual for dsh agent
├── .gitignore               # Strictly excludes models/, outputs/, .cache/, node_modules/
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
│   ├── typesetter.py        # CJK vertical/horizontal layout & font auto-fitting
│   ├── postprocess.py       # Guided Filter L-channel line art composite
│   ├── colorizer.py         # ComfyUI FLUX.2 client & execution engine
│   ├── pipeline.py          # Unified pipeline orchestrator
│   └── utils.py             # Unicode image IO, geometry, and config utilities
├── scripts/
│   ├── shot.py              # Primary CLI interface (single page / batch)
│   ├── server.py            # Lightweight Python server hosting TypeScript GUI
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

## License

- Code in this repository is licensed under **AGPL-3.0** (see `LICENSE`).
