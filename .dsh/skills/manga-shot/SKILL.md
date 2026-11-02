---
name: manga-shot
description: "Use when the user requests 一键漫画汉化上色, 自动识别文字与色彩, 进阶无字上色再嵌字, 漫画翻译, 漫画上色, manga translation & colorization, advanced inpainting-colorization-typesetting, or batch processing with this integrated MangaShot repository; load this skill before running any translation or colorization task."
---

# MangaShot Skill (AI Agent Guide)

MangaShot is a unified one-click Japanese manga translation and colorization pipeline integrating **MangaTranslate** and **MangaColour**.

## 1. Prerequisites & Verification Gates

Always run commands from the repository root `F:\TEMP\anime\MangaShot\repo`.
Do not execute any task until the diagnostic check passes:

1. **Check Environment & Services**:
   ```powershell
   python scripts/check_setup.py --config config.example.json
   ```
   - Checks Python packages, CUDA GPU acceleration (RTX 3060 6GB+ supported).
   - Verifies bubble detector (`models/detector/comic-speech-bubble-detector.pt`).
   - Verifies Manga-OCR base (`models/ocr/manga-ocr-base/model.safetensors`).
   - Verifies Translation API gateway (`http://127.0.0.1:8045/v1` with `gemini-3.8-flash-tiered`).
   - Verifies ComfyUI connectivity (`http://127.0.0.1:8000`) when colorization is requested.
2. If models are missing on a fresh machine:
   ```powershell
   .\scripts\download_models.ps1
   ```
   Automatically hardlinks/copies models from existing local repos or downloads from HuggingFace.

---

## 2. Pipeline Execution Modes

- **`auto` (智能全自动，默认模式)**:
  - 自动检测色彩（Lab 空间饱和度判断）：若为黑白则触发全彩上色。
  - 自动检测文字（OCR 采样与假名统计）：若为日文/非中文则触发汉化翻译。
  - 两者皆是时，自动启动**进阶模式 (Advanced)**。
- **`advanced` (进阶模式，最推荐的汉化上色流水线)**:
  - **核心原理**：
    1. 在生肉黑白原稿上检测文字气泡并 OCR。
    2. 提交带有坐标位置控制的 JSON 文件给 Gemini 3.8 Flash，进行整篇连贯翻译。
    3. 在黑白原图上精细擦除日文字迹（保留气泡边界线条），生成纯净无字的黑白底图。
    4. 将无字底图送入 ComfyUI FLUX.2 进行参考图全彩扩散上色 + 引导滤波复合。
    5. 在生成的全彩漫画图上，将经过位置校验的中文译文以高解析度矢量文字直接加回（加白色描边抗背景混叠）。
    6. **彻底避免扩散模型在去噪过程中将中文字体模糊化或产生乱码幻觉，保证汉化文字绝对锐利！**
- **`both`**: 强制同时执行汉化翻译与全彩上色。
- **`translate`**: 仅执行漫画检测、OCR、翻译、气泡擦除与排版嵌字。
- **`colorize`**: 仅执行基于参考图的 FLUX.2 扩散上色与轮廓复合。

---

## 3. CLI Command Guide

### 3.1 单页处理 (Single Page)
```powershell
python scripts/shot.py `
  --input "example/002.jpg" `
  --output "outputs/single_test" `
  --mode advanced `
  --reference "examples/sample_reference.jpg"
```

### 3.2 批量全话连贯处理 (Batch Chapter)
```powershell
python scripts/shot.py `
  --input "example/(C91) 泣かないで! 桃ちゃん!! 1 (別スキャン)" `
  --output "outputs/chapter_01" `
  --mode auto `
  --reference "examples/sample_reference.jpg" `
  --glob "*.jpg" `
  --contact-sheet
```

- 批量处理会自动以整话（Whole-Chapter）对话流的形式提交给 API 翻译，并校验全部 100% 的坐标位置（`id`, `page`, `box`），确保角色人名、语气和对话在跨页时的全局连贯性。
- 完成后自动生成整话缩略展板 `outputs/chapter_01/contact_sheet.jpg`。

---

## 4. TypeScript Web GUI (人类交互界面)

MangaShot 提供了现代化的 TypeScript Web GUI：

1. **启动本地服务器**（无需额外安装前端运行时）：
   ```powershell
   python scripts/server.py --port 7860
   ```
   打开浏览器访问：`http://127.0.0.1:7860`。
2. **前端开发模式**（如需二次修改 UI）：
   ```powershell
   cd gui
   npm run dev
   ```

---

## 5. 严格约束 (Hard Constraints)

- 绝不提交 `outputs/`、`models/`、`.cache/` 或 `gui/node_modules/`；已在 `.gitignore` 中严格排除。
- 在使用任何批处理或高级命令前，必须先确认 `scripts/check_setup.py` 返回成功。
- 坐标控制规范：翻译 API 必须通过带有 `id`, `page`, `box`, `text` 的 JSON 数据交互，并在程序中校验返回结果的坐标一致性，杜绝错位。

---

## 6. 中文速查摘要

- **自检**：`python scripts/check_setup.py`
- **进阶汉化上色单页（默认叠加复合模式）**：`python scripts/shot.py -i <图片> -o <输出> -m advanced -r <参考图> --color-mode composite`
- **浓烈色彩模式单页**：`python scripts/shot.py -i <图片> -o <输出> -m advanced -r <参考图> --color-mode direct`
- **整话批量连贯处理**：`python scripts/shot.py -i <文件夹> -o <输出> -m auto -r <参考图> --color-mode composite --contact-sheet`
- **Web 界面**：`python scripts/server.py`（访问 `http://127.0.0.1:7860`）
