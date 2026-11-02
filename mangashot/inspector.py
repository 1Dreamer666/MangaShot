# -*- coding: utf-8 -*-
"""
Smart content inspector for MangaShot:
Automatically inspects whether an image is B&W/grayscale (needs colorization)
and whether detected text is Japanese/non-Chinese (needs translation).
"""
from typing import List, Tuple
import re
import cv2
import numpy as np


class ContentInspector:
    """Inspects visual chroma and language properties of manga pages."""

    # Unicode ranges for Japanese Kana
    HIRAGANA_REGEX = re.compile(r"[\u3040-\u309f]")
    KATAKANA_REGEX = re.compile(r"[\u30a0-\u30ff\uff65-\uff9f]")
    CJK_UNIFIED_REGEX = re.compile(r"[\u4e00-\u9fff]")
    LATIN_REGEX = re.compile(r"[a-zA-Z]")

    @staticmethod
    def is_grayscale_manga(
        image: np.ndarray, 
        chroma_threshold: float = 6.5,
        sample_pixels: int = 50000
    ) -> Tuple[bool, float]:
        """
        Determine whether an image is black-and-white / grayscale manga.
        
        Uses LAB color space:
        a* and b* channels represent color deviation from neutral gray (128).
        In B&W or screentoned manga, chroma = sqrt((a-128)^2 + (b-128)^2) is very low.

        Returns:
            Tuple of (is_grayscale: bool, avg_chroma: float)
        """
        if len(image.shape) == 2:
            return True, 0.0

        h, w = image.shape[:2]
        # Downsample for quick computation if image is large
        if h * w > sample_pixels:
            scale = np.sqrt(sample_pixels / float(h * w))
            small = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            small = image

        lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)
        a = lab[:, :, 1] - 128.0
        b = lab[:, :, 2] - 128.0
        chroma = np.sqrt(a * a + b * b)
        
        # 90th percentile chroma to avoid stray colored dust or minor scan tint
        p90_chroma = float(np.percentile(chroma, 90))
        is_bw = p90_chroma < chroma_threshold
        return is_bw, round(p90_chroma, 2)

    @classmethod
    def is_non_chinese(cls, texts: List[str]) -> Tuple[bool, str]:
        """
        Analyze extracted OCR texts to determine if the page requires translation to Chinese.
        
        Returns:
            Tuple of (needs_translation: bool, detected_lang: str)
        """
        combined = "".join(texts).replace(" ", "").replace("\n", "")
        if not combined:
            return False, "empty"

        total_chars = len(combined)
        kana_count = len(cls.HIRAGANA_REGEX.findall(combined)) + len(cls.KATAKANA_REGEX.findall(combined))
        cjk_count = len(cls.CJK_UNIFIED_REGEX.findall(combined))
        latin_count = len(cls.LATIN_REGEX.findall(combined))

        # If Japanese Kana characters are present, it is definitely Japanese
        if kana_count > 0:
            return True, f"japanese (kana={kana_count})"

        # If predominantly Latin letters
        if latin_count > total_chars * 0.4:
            return True, f"western/english (latin={latin_count})"

        # If Chinese characters dominate and 0 Kana, it is already Chinese
        if cjk_count > total_chars * 0.4:
            return False, "chinese"

        # Default fallback: if any foreign characters, translate
        return False, "unknown"
