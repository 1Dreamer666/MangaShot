[English](README.md) | **中文**

# MangaShot 日漫一键翻译与全彩上色工作台

**基于大语言模型与扩散模型的全自动日漫汉化、修图与全彩上色集成流水线。**

MangaShot 深度集成了 **MangaTranslate** 与 **MangaColour** 两个核心开源项目的能力，打造出一套工业级、高保真的漫画一键汉化与全彩上色解决方案。它支持色彩与语言自动检测、基于**坐标控制 JSON 协议（Positional JSON Protocol）**的全局连贯翻译、气泡轮廓保护型擦除、ComfyUI FLUX.2 扩散上色与引导滤波轮廓复合，并同时提供**面向人类交互的 TypeScript Web GUI** 与**面向 AI 调用的 `.dsh` Skill** 两种交互形态。

---

## 核心特性

### 1. 智能画面与语言自检（Auto-Detect）
- **画面色彩感知**：在 LAB 色彩空间中测算第 90 百分位饱和度与色度差（Chroma）。若为黑白/网点漫画，则自动触发全彩上色；若已是彩色画面，则自动跳过上色阶段。
- **语言假名统计**：对气泡 OCR 提取文本进行平假名、片假名（`\u3040-\u30ff`）及字符集统计。若检测到日文或外文，自动触发汉化翻译；若已是简体中文，则跳过翻译。

### 2. 独创进阶模式（Advanced Orchestration Mode，强烈推荐）
如果直接在已经嵌好中文的图片上进行扩散模型上色，扩散模型的去噪采样极易将精细的中文字符糊化、产生扭曲噪点或边缘色晕；反之，若先上色再擦字，彩色背景下的气泡擦除极易留存色斑。
MangaShot 采用精妙的四步编排方案：
1. **生肉检测与连贯翻译**：在黑白线稿上通过 YOLOv8 与 Manga-OCR 提取文字气泡，提交带坐标控制的 JSON 进行连贯汉化。
2. **黑白无字底图生成（Inpaint）**：运用连通域分析滤除外围气泡轮廓，只擦除气泡内部日文字迹，生成干净纯净的无字黑白稿（Text-Free B&W）。
3. **无字扩散上色（FLUX.2 Colorization）**：将无字稿送入 ComfyUI 进行参考图配色迁移，并运用 He 等人的引导滤波（Guided Filter）复合原始全解析度亮度线稿，得到色彩绚丽且完全没有文字干扰的纯净彩色底图。
4. **超锐度矢量重嵌（Vector-Sharp Typeset）**：在最终生成的彩色底图上，将经过位置校验的中文字体加回（带自适应白色对比度描边）。**汉化文字保持 100% 矢量级高解析度锐利边缘，绝无扩散模糊与杂色！**

### 3. 上色色彩处理模式 (Colorization Modes)
MangaShot 全面提供两种不同取向的上色渲染架构（在 GUI、CLI 与 Skill 中均可通过 `--color-mode` 切换）：
- **`composite` 叠加复合模式 (默认 / 强烈推荐)**：
  继承并升级了 MangaColour 的核心精髓。将扩散模型在 0.5 MP 下生成的色彩层转至 LAB 色彩空间，仅提取其 $a, b$ 色度通道，使用原始 2000px 全解析度无字线稿作为亮度 $L$ 引导通道执行导向滤波（Guided Filter）复合；同时激活 `white_threshold=245.0` 纯白保护与气泡漂白机制。**彻底杜绝模型把对白框涂成蓝/粉色色块的问题，文字和线条保持 100% 原始印刷级锐利**。
- **`direct` 浓烈色彩模式 (直接上色选项)**：
  跳过线稿色度复合，直接将扩散模型去噪采样的原始画幅插值放大作为背景底图。色彩浓郁奔放、画风极具油画与厚涂质感，适合原著线条较淡或追求纯粹扩散生成画风的使用场景。

### 4. 坐标控制 JSON 协议与整部全书连贯性
- 放弃生硬脆弱的无上下文单句翻译，所有对话项严格绑定空间元数据：`{"id": 1, "page": "002.jpg", "box": [x1, y1, x2, y2], "text": "..."}`。
- 批处理整话漫画时，自动整合整话全篇对话上下文提交给大模型，保证跨页、多话之间的人称代词、角色语气、称谓（如“河岛前辈”、“小桃”）高度连贯统一。
- 客户端严格校验回传的每个气泡坐标，自动锚定回真值边界框，彻底规避坐标漂移。

### 5. 人类与 AI 双交互支持
- **人类用户选项**：现代化的 **TypeScript Web GUI**（遵循 Google Material Design 3 Expressive 规范构建），全站统一使用官方 **Material Symbols Rounded** 可变矢量图标。内置双联画 QA 对比滑块、台词与坐标在线校对表、**多章节任务队列卡片（Multi-Folder Batch Queue，支持跨目录一键克隆与独立基准色）**及**原生文件/多图混选自动归类器**，由 Python 后端（`scripts/server.py`）托管于 `http://127.0.0.1:7860`。
- **AI 智能体选项**：内置专为 `dsh` 打造的 **`.dsh` Skill**（`.dsh/skills/manga-shot/SKILL.md`），工作区根目录预置软连接，AI 可直接调用。

---

## 目录结构

```text
.
├── .dsh/                    # AI Agent 技能配置目录
│   └── skills/manga-shot/
│       └── SKILL.md         # dsh 专用技能说明与操作手册
├── .gitignore               # 严格排除 models/、outputs/、.cache/、node_modules/
├── LICENSE                  # AGPL-3.0 开源协议
├── README.md                # 英文说明文档
├── README_ZH.md             # 中文说明文档
├── requirements.txt         # 核心 Python 依赖包清单
├── config.example.json      # 全局配置模板（API、ComfyUI、检测器、字体等）
├── config/
│   └── extra_model_paths.yaml # ComfyUI 模型映射配置
├── mangashot/               # 核心算法与管道包
│   ├── __init__.py
│   ├── inspector.py         # 色彩饱和度与语言假名智能自检器
│   ├── detector.py          # YOLOv8 漫画气泡与独立文字检测模块
│   ├── ocr.py               # Manga-OCR 封装（支持 safetensors 与 CUDA）
│   ├── translator.py        # 带坐标控制 JSON 协议与缓存的大模型翻译客户端
│   ├── inpainter.py         # 轮廓保护型连通域气泡擦除模块
│   ├── typesetter.py        # CJK 竖排横排与自适应字号排版引擎
│   ├── postprocess.py       # 引导滤波线稿高频亮度复合模块
│   ├── colorizer.py         # ComfyUI FLUX.2 上色客户端与工作流引擎
│   ├── pipeline.py          # 全功能流水线协同调度器
│   └── utils.py             # 宽字符图像读写、阅读顺序重排工具
├── scripts/
│   ├── shot.py              # 统一命令行入口（单页/整话批量/展板生成）
│   ├── server.py            # TypeScript Web GUI 托管服务（标准库零额外依赖）
│   ├── check_setup.py       # 环境、模型、网关连通性自检诊断脚本
│   ├── download_models.ps1  # 自动化模型链接与下载脚本
│   └── make_contact_sheet.py# 批量成果自适应拼板生成脚本
├── gui/                     # TypeScript Web GUI 前端工程
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/                 # React + TS 页面组件源码
│   └── dist/                # 预先编译打包的静态产物
└── examples/
    └── sample_reference.jpg # 演示配色参考图
```

---

## 快速上手

### 1. 安装依赖
```powershell
python -m pip install -r requirements.txt
```

### 2. 准备模型权重
```powershell
.\scripts\download_models.ps1
```
*(若本地已存在 MangaColour 与 MangaTranslate，脚本会自动创建软链接复用已有的 12GB 权重，免重复下载)*。

### 3. 运行环境自检
```powershell
python scripts/check_setup.py --config config.example.json
```

### 4. 方式 A：启动 TypeScript Web GUI（供人类使用）
```powershell
python scripts/server.py --port 7860
```
在浏览器中打开 `http://127.0.0.1:7860`，即可使用图形化界面进行参数调节、交互式生熟肉比对和台词坐标二次校对。

### 5. 方式 B：通过 CLI 或 .dsh Skill 执行（供 AI 与命令行使用）

**单页处理（进阶汉化上色模式）**：
```powershell
python scripts/shot.py `
  --input "path/to/page.jpg" `
  --output "outputs/single" `
  --mode advanced `
  --reference "examples/sample_reference.jpg"
```

**整话全书批量连贯处理**：
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

## 流水线运行模式说明

| 模式名称 (`--mode`) | 处理机制 | 适用场景 |
|---|---|---|
| `auto` (默认) | 智能检测色彩与文字 | 黑白自动上色，非中文自动汉化；两者兼备时自动启动 `advanced` 模式。 |
| `advanced` (推荐) | 先擦后色再嵌字 | 生肉擦除日文 -> 无字全彩上色 -> 重新叠加矢量锐利中文，彻底解决字迹模糊。 |
| `both` | 强制双重处理 | 无论输入状态如何，一律执行汉化与上色全流程。 |
| `translate` | 仅汉化翻译 | 仅执行气泡检测、OCR、连贯翻译、气泡擦除与排版嵌字。 |
| `colorize` | 仅全彩上色 | 仅基于参考图执行 FLUX.2 扩散上色与线稿高频复合。 |

---

## 开源协议

- 本项目代码遵循 **AGPL-3.0** 开源协议（参见 `LICENSE`）。
