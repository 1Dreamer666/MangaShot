# -*- coding: utf-8 -*-
"""
Module for extracting clean manga series / title names using Gemini / Claude LLMs.
Used to organize outputs into clean, hierarchical folders based on work title.
"""
from pathlib import Path
from typing import List, Union, Optional
import os
import re
import requests

SYSTEM_PROMPT = """你是漫画文件整理专家。输入是一组漫画目录或文件的路径列表，请分析并提取它们共同所属的漫画核心作品名/系列名，作为输出主文件夹名称。

严格规则：
1. 忽略作者/社团名（如 [のりんこ (のりんこ)]）、作品编号（如 7643-）、分类目录（如 1. 同人志）、日期（如 [2022.08]）、展会场次（如 (C100)、(C102)）、卷号/话数（如 1、2、3、4、5 或 第01话）、扫描版本说明（如 (別スキャン)）、汉化组后缀等。
2. 如果多个路径属于同一部漫画的不同卷/话，提取并返回去掉卷号/话数后的共同核心作品名。
3. 严格只返回纯粹的作品名，禁止包含任何路径前缀、标点符号、引号、冒号、Markdown 代码块或多余解释。
4. 确保名称适合作为操作系统文件夹名称（不能包含 \\ / : * ? " < > | 等非法字符）。"""

def sanitize_folder_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', '_', name.strip())
    cleaned = cleaned.strip('. ')
    return cleaned or "MangaOutput"

def infer_main_title(
    paths: List[Union[str, Path]],
    base_url: str = "http://127.0.0.1:8045/v1",
    api_key: str = "sk-42c3360b3d73446ab1c87b7ce35f9b99",
    primary_model: str = "gemini-3.8-flash-tiered",
    fallback_model: str = "claude-sonnet-4-6",
    timeout: int = 15,
) -> str:
    if not paths:
        return "MangaOutput"

    # Step 1: Collect paths per user rule
    # "如果只有单图片，则查看所有单图片的目录路径，但若有目录名，则不看图片路径"
    dir_paths = []
    file_parent_paths = []

    for p in paths:
        p_str = str(p).strip()
        if not p_str:
            continue
        path_obj = Path(p_str)
        if path_obj.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
            file_parent_paths.append(str(path_obj.parent))
        else:
            dir_paths.append(p_str)

    target_paths = dir_paths if dir_paths else file_parent_paths
    if not target_paths:
        target_paths = [str(paths[0])]

    # Deduplicate while preserving order
    unique_paths = list(dict.fromkeys(target_paths))
    user_content = "\n".join(unique_paths)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    def _call_model(model_name: str) -> Optional[str]:
        try:
            resp = requests.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json={
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.1,
                },
                timeout=timeout,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                content = re.sub(r"^```(?:json|text)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)
                content = content.strip("\"' \n\r\t")
                if content:
                    return content
            else:
                print(f"[Title Inference] HTTP {resp.status_code} from {model_name}: {resp.text[:200]}")
        except Exception as e:
            print(f"[Title Inference] Error calling {model_name}: {e}")
        return None

    print(f"[Title Inference] Querying primary model '{primary_model}' for title extraction...")
    title = _call_model(primary_model)
    if title:
        sanitized = sanitize_folder_name(title)
        print(f"[Title Inference] Primary model '{primary_model}' extracted title: {sanitized}")
        return sanitized

    print(f"[Title Inference] Primary model failed or timed out. Falling back to '{fallback_model}'...")
    title = _call_model(fallback_model)
    if title:
        sanitized = sanitize_folder_name(title)
        print(f"[Title Inference] Fallback model '{fallback_model}' extracted title: {sanitized}")
        return sanitized

    sample = Path(unique_paths[0]).name
    clean_sample = re.sub(r"\[.*?\]|\(.*?\)|【.*?】", "", sample).strip()
    return sanitize_folder_name(clean_sample or sample)
