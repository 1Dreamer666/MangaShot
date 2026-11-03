---
name: manga-shot
description: "Use when the user requests 一键漫画汉化上色, 自动识别文字与色彩, 进阶无字上色再嵌字, 漫画翻译, 漫画上色, 缓存重上色, 仅重嵌字, GUI 多章节批量, manga translation & colorization, advanced inpainting-colorization-typesetting, or batch processing with this integrated MangaShot repository; load this skill before running any translation or colorization task."
---

# MangaShot Skill (AI Agent Guide)

MangaShot is a unified one-click Japanese manga translation and colorization pipeline integrating **MangaTranslate** and **MangaColour**.

Run every command from the repository root (the directory containing `mangashot/` and `scripts/`). Do not hard-code a machine-specific path into commands or configs.

## 1. Prerequisites & Verification Gates

Do not execute any task until the diagnostic check passes:

1. **Check environment & services**:
   ```powershell
   python scripts/check_setup.py --config config.example.json
   ```
   - Checks Python packages, CUDA GPU acceleration (RTX 3060 6 GB+ supported).
   - Verifies bubble detector (`models/detector/comic-speech-bubble-detector.pt`).
   - Verifies Manga-OCR base (`models/ocr/manga-ocr-base/model.safetensors`).
   - Verifies the translation API gateway (`http://127.0.0.1:8045/v1`, `gemini-3.8-flash-tiered`).
   - Verifies ComfyUI connectivity (`http://127.0.0.1:8000`) when colorization is requested.
2. If models are missing on a fresh machine:
   ```powershell
   .\scripts\download_models.ps1
   ```
   It hardlinks/copies models from existing local repos or downloads them from HuggingFace.
3. Start ComfyUI **with stdout and stderr redirected to log files** when running on Windows. A dead inherited pipe makes tqdm raise `OSError: [Errno 22] Invalid argument` during sampler setup. Do not work around that error by changing steps.
4. Keep the translation API and ComfyUI running before a batch. If either is offline, stop and report the blocker instead of starting a long run.

## 2. Tuned Defaults & Guardrails

The checked-in defaults are measured on an RTX 3060 6 GB with FLUX.2 Klein 9B Q3 GGUF + `manga_colorization` LoRA:

| Setting | Value | Why |
|---|---:|---|
| `comfyui.steps` | `2` | 1 step is fastest but too pale; 3–5 steps are slower and colder/washed out. |
| `comfyui.cfg` | `1.0` | Guidance-free: cuts U-Net forward passes in half, removes cyan/magenta fringing in skin highlights. |
| `comfyui.megapixels` | `0.5` | Fits 6 GB while keeping enough chroma detail. |
| `pipeline.color_batch_size` | `3` | Measured sweet spot on 6 GB VRAM (~5.6 GB peak); steady state reaches 13.8 s / page. |
| `comfyui.prompt` | `mngclranm` | LoRA trigger. An empty prompt degrades toward gray/white. |
| `comfyui.postprocess.sat` | `1.3` | AB backfill discards the model L channel; 1.3 restores warm skin without yellowing paper. |
| `comfyui.postprocess.white_threshold` | `256.0` | Protects paper and bubble whites. |
| `--color-mode` | `composite` | Keeps original line art/text sharp; `direct` is only for painterly experiments. |

Guardrails & ComfyUI Launch Flags:

- Launch ComfyUI with `--fp16-vae` on 6 GB GPUs; it cleanly reduces VAE decoding peaks with zero visual quality loss.
- Do **not** use `--highvram`: 6 GB cannot hold the 6.5 GB CLIP + 4.7 GB diffusion model together; forcing it causes catastrophic PCIe shared-memory thrashing (steps degrade from 7 s to 700+ s).
- Do **not** use `--use-split-cross-attention`: breaks SDPA optimization on PyTorch 2.x, drops GPU-resident weights to 0 MB, and increases idle 0% utilization.
- Do **not** use `--vram-headroom`: excessively evicts weights to system RAM, collapsing GPU utilization to ~20%.
- Do **not** raise steps to “improve quality”. On this LoRA, 4–5 steps converge to a colder, whiter palette and cost 45–140% more time.
- Do **not** remove the `mngclranm` trigger from the prompt.
- Do **not** raise `sat` far above 1.3; clothing and backgrounds become over-saturated.
- Pages of different dimensions (for example, a 2832×2000 double-page spread) must form separate batches; the pipeline does this automatically.
- Restart `scripts/server.py` after changing any config value it loads at startup.
- Two-stage workflow for highest throughput on 6 GB: run `shot.py -m translate` on the chapter first to cache translations and text-free bases; then run `colorize_cached.py --batch-size 3 --cfg 1.0` for uninterrupted GPU colorization.

Measured two-page timings at 0.5 MP / batch 2: 1 step ≈ 27.7 s, 2 steps ≈ 50.5 s, 3 steps ≈ 74.2 s, 4 steps ≈ 98.5 s, 5 steps ≈ 121.0 s. Model-load time varies.

## 3. Pipeline Execution Modes

- **`auto` (智能全自动，默认模式)**:
  - Detects chroma in LAB space; B&W pages trigger colorization.
  - Detects Japanese/non-Chinese text via OCR sampling and kana counts; those pages trigger translation.
  - If both are needed, runs **advanced** automatically.
- **`advanced` (进阶模式，最推荐)**:
  1. Detect bubbles and OCR the B&W page.
  2. Translate the whole chapter through positional JSON.
  3. Inpaint Japanese text while protecting bubble borders.
  4. Colorize the text-free B&W page with FLUX.2 + guided-filter L composite.
  5. Re-typeset Chinese with vector-sharp glyphs and contrast strokes.
- **`both`**: Force translation + colorization.
- **`translate`**: Detection, OCR, translation, inpainting, and typesetting only.
- **`colorize`**: Reference-guided FLUX.2 colorization only, using the batch fast path.

## 4. CLI Command Guide

### 4.1 Single page (advanced)
```powershell
python scripts/shot.py `
  --input "path/to/page.jpg" `
  --output "outputs/single" `
  --mode advanced `
  --reference "examples/sample_reference.jpg" `
  --color-mode composite
```

### 4.2 Whole chapter / batch
```powershell
python scripts/shot.py `
  --input "path/to/manga_chapter/" `
  --output "outputs/chapter_01" `
  --mode auto `
  --reference "examples/sample_reference.jpg" `
  --glob "*.jpg" `
  --contact-sheet
```

- Batch translation submits the whole chapter dialogue with global context, keeping names, pronouns, and tone consistent across pages.
- A contact sheet is written to `outputs/chapter_01/contact_sheet.jpg`.

### 4.3 Cached re-color / re-typeset
When detection, OCR, and translation are already cached as `<stem>_text_free_bw.png` + `<stem>.json`:

```powershell
python scripts/colorize_cached.py --pages 006,007 --force
```

- Defaults: `steps=2`, `cfg=1.0`, `megapixels=0.5`, `batch-size=3`, `sat=1.3`, `prompt=mngclranm`.
- Use `--no-typeset` to colorize only and skip cached text.
- Point `--intermediate`, `--json-dir`, and `--output-dir` at the actual cached directories when they are not the defaults.
- The script groups pages by dimensions and preserves natural page order.

### 4.4 Typeset-only fix (CPU, no GPU)
When the colorization is already correct and only text needs to be redrawn (for example, a missing `♡` glyph):

1. Load `intermediate/<stem>_colorized_text_free.png` — the exact colorized background used by the pipeline.
2. Load `json/<stem>.json` and read its `bubbles`.
3. Run `MangaTypesetter.typeset_bubble()` for each bubble's `box` and `translation`.
4. Overwrite the final `<stem>.png`, then rebuild the contact sheet/QA comparisons.

This is CPU-only and leaves the colorization pixel-identical. Do **not** re-colorize for a typesetting-only bug. Verify by diffing old/new outside the bubble boxes: the background difference must be zero.

## 5. TypeScript Web GUI (Human Interface)

Start the server:

```powershell
python scripts/server.py --port 7860
```

Open `http://127.0.0.1:7860`.

- **Multi-chapter queue**: add, clone, or delete chapter cards; run them sequentially; each chapter can use the global reference or its own.
- **Discrete page selection**: pick individual pages or cross-directory groups. Explicit selections take precedence over the page-range filter.
- **Native pickers**: system file/directory dialogs, with a browser fallback.
- **Title inference**: `POST /api/infer_title` extracts the series title for `outputs/<series>/<chapter>/`; the queue sends `chapter_name` explicitly.
- **Batch API**: `POST /api/batch` accepts `selected_files` and `extra_groups`, preserves natural page order, and honors `force`.
- **Modes**: `仅漫画上色` is the fast colorize-only path; `进阶汉化上色` is the full inpaint → colorize → typeset path. New raw Japanese pages normally need `进阶汉化上色`.

## 6. Typesetting & Symbol Fallback

- Chinese text uses the configured CJK font (`typesetter.font_path`, usually `msyh.ttc`).
- Microsoft YaHei / SimHei do not cover `♡ ♥ ♦ ♣ ♠ ♪ ♬ ✕ ❤`. `MangaTypesetter.SYMBOL_FALLBACK_CHARS` routes those glyphs to a symbol font (Segoe UI Symbol on Windows; DejaVu Sans / Noto Symbols on Linux).
- Horizontal lines are rendered as consecutive font runs; vertical columns select the font per character. This avoids tofu boxes (`口`) and stroke seams.
- To support a new symbol, add it to `SYMBOL_FALLBACK_CHARS` and make sure the symbol font exists.

## 7. Troubleshooting

- **`OSError: [Errno 22] Invalid argument` from ComfyUI tqdm**: restart ComfyUI with stdout/stderr redirected to files. The inherited pipe is dead; this is not a sampler/step problem.
- **Pages look gray/white**: check that `prompt` contains `mngclranm`, `steps=2`, and `postprocess.sat=1.3` for composite mode. Empty prompts and step inflation both wash out color.
- **`♡`/`♥`/`♦` show as `口`**: the CJK font lacks the glyph; keep `seguisym.ttf` available or extend the fallback set.
- **GUI shows ComfyUI offline**: start ComfyUI at `comfyui.base_url`; pages will otherwise fail one by one.
- **Output is skipped**: the pipeline skips existing final PNGs unless `force` is set. Use `--force` for CLI or enable force in the GUI batch request.

## 8. Hard Constraints

- Never commit `outputs/`, `models/`, `inputs/`, `.cache/`, or `gui/node_modules/`; they are excluded by `.gitignore`.
- Do not commit secrets, API keys, absolute machine paths, or user manga pages.
- Run `scripts/check_setup.py` before any batch or advanced command.
- Translation API data must keep the positional JSON contract (`id`, `page`, `box`, `text`) and be re-anchored to the original coordinates.
- Do not claim success if ComfyUI is offline, the diagnostic check fails, or the expected final/QA files are missing. Report the blocker and the checks completed.
- For typesetting-only fixes, do not re-colorize; reuse the saved `_colorized_text_free.png` background.

## 9. 中文速查摘要

- **自检**：`python scripts/check_setup.py --config config.example.json`
- **进阶汉化上色单页**：`python scripts/shot.py -i <图片> -o <输出> -m advanced -r <参考图> --color-mode composite`
- **整话批量连贯处理**：`python scripts/shot.py -i <文件夹> -o <输出> -m auto -r <参考图> --color-mode composite --contact-sheet`
- **缓存重上色**：`python scripts/colorize_cached.py --pages 006,007 --force`（默认 2 step、cfg 1.0、sat 1.3、batch 3）
- **仅重嵌字**：加载 `intermediate/<stem>_colorized_text_free.png` + `json/<stem>.json`，用 `MangaTypesetter` 重绘，纯 CPU，不重上色。
- **Web 界面**：`python scripts/server.py`，访问 `http://127.0.0.1:7860`。
- **核心默认值**：`steps=2`、`cfg=1.0`、`megapixels=0.5`、`color_batch_size=3`、`prompt=mngclranm`、`sat=1.3`、`composite`。
- **ComfyUI 推荐参数**：`--fp16-vae`；严禁 `--highvram`、`--use-split-cross-attention`、`--vram-headroom`。
- **不要**用 1 step 出成品（太淡），也不要用 4–5 step“提质量”（更冷、更白、更慢）。
