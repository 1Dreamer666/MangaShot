# -*- coding: utf-8 -*-
"""
MangaShot: One-Click AI Manga Translation & Colorization Pipeline.
Integrates MangaTranslate and MangaColour.
"""
__version__ = "0.1.0"

from .inspector import ContentInspector
from .detector import BubbleDetector, Detection
from .ocr import MangaOcrWrapper
from .translator import GeminiTranslator
from .inpainter import MangaInpainter
from .typesetter import MangaTypesetter
from .postprocess import composite_chroma, guided_filter
from .colorizer import MangaColorizer, ComfyColorizeError
from .titles import infer_main_title
from .pipeline import MangaShotPipeline

__all__ = [
    "ContentInspector",
    "BubbleDetector",
    "Detection",
    "MangaOcrWrapper",
    "GeminiTranslator",
    "MangaInpainter",
    "MangaTypesetter",
    "composite_chroma",
    "guided_filter",
    "MangaColorizer",
    "ComfyColorizeError",
    "infer_main_title",
    "MangaShotPipeline",
]
