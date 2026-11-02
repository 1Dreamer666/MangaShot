# -*- coding: utf-8 -*-
"""
Preserve original line art luminance and composite with model-generated chroma.
Uses He et al.'s Guided Filter in LAB color space.
"""
from pathlib import Path
from typing import Union, Optional
import cv2
import numpy as np

from .utils import imread_unicode, imwrite_unicode


def guided_filter(guide: np.ndarray, src: np.ndarray, radius: int = 2, eps: float = 1e-4) -> np.ndarray:
    """Fast guided filter for a single-channel float image."""
    guide = guide.astype(np.float32)
    src = src.astype(np.float32)
    ksize = (2 * radius + 1, 2 * radius + 1)
    mean_i = cv2.boxFilter(guide, cv2.CV_32F, ksize)
    mean_p = cv2.boxFilter(src, cv2.CV_32F, ksize)
    corr_i = cv2.boxFilter(guide * guide, cv2.CV_32F, ksize)
    corr_ip = cv2.boxFilter(guide * src, cv2.CV_32F, ksize)
    var_i = corr_i - mean_i * mean_i
    cov_ip = corr_ip - mean_i * mean_p
    a = cov_ip / (var_i + eps)
    b = mean_p - a * mean_i
    mean_a = cv2.boxFilter(a, cv2.CV_32F, ksize)
    mean_b = cv2.boxFilter(b, cv2.CV_32F, ksize)
    return mean_a * guide + mean_b


def composite_chroma(
    original_bgr: np.ndarray,
    color_bgr: np.ndarray,
    radius: int = 2,
    sat: float = 1.0,
    white_threshold: float = 256.0,
    neutral_mask: bool = False,
) -> np.ndarray:
    """
    Composite original luminance with generated chroma.
    
    Args:
        original_bgr: High-resolution original manga image (BGR).
        color_bgr: Model-generated color image (BGR).
        radius: Guided filter radius.
        sat: Saturation multiplier.
        white_threshold: Threshold above which chroma is zeroed (256 disables).
        neutral_mask: Use chroma-based neutral mask.
        
    Returns:
        High-resolution composite BGR image.
    """
    h, w = original_bgr.shape[:2]
    if color_bgr.shape[:2] != (h, w):
        color_bgr = cv2.resize(color_bgr, (w, h), interpolation=cv2.INTER_CUBIC)

    original_lab = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    color_lab = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    l_orig = original_lab[:, :, 0]
    a = color_lab[:, :, 1] - 128.0
    b = color_lab[:, :, 2] - 128.0

    guide = l_orig / 255.0
    a = guided_filter(guide, a, radius=radius, eps=1e-4)
    b = guided_filter(guide, b, radius=radius, eps=1e-4)
    a *= sat
    b *= sat

    if white_threshold < 255.0:
        white = l_orig >= white_threshold
        if neutral_mask:
            chroma = np.sqrt(a * a + b * b)
            remove = white & (chroma < 6.0)
        else:
            remove = white & (b < -2.0)
        a[remove] = 0.0
        b[remove] = 0.0

    out_lab = np.dstack([l_orig, a + 128.0, b + 128.0]).clip(0, 255).astype(np.uint8)
    out_bgr = cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)
    return out_bgr
