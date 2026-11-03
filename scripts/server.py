#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Lightweight Web GUI Server for MangaShot.
Serves the TypeScript frontend (gui/dist) and provides REST APIs for the pipeline.
Requires only Python standard library.
"""
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Optional, Dict, Any, List
import urllib.parse

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from mangashot.pipeline import MangaShotPipeline, DEFAULT_CONFIG
from mangashot.titles import infer_main_title
from scripts.make_contact_sheet import create_contact_sheet


def run_picker_process(mode: str, initial_dir: Optional[str] = None) -> dict:
    picker_script = str(repo_root / "scripts" / "native_picker.py")
    args = [sys.executable, picker_script, mode]
    if initial_dir and os.path.isdir(initial_dir):
        args.append(str(initial_dir))

    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"

    def error_result(message: str) -> dict:
        return {
            "status": "error",
            "message": message,
            "path": "",
            "paths": [],
            "dir": "",
            "files": [],
        }

    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            env=env,
            timeout=300
        )
        raw_text = proc.stdout.decode("utf-8", errors="replace").strip() if proc.stdout else ""
        if raw_text:
            try:
                return json.loads(raw_text)
            except json.JSONDecodeError as exc:
                return error_result(f"选择器返回了无效数据: {exc}")
        err_text = proc.stderr.decode("utf-8", errors="replace").strip() if proc.stderr else ""
        if proc.returncode != 0 or err_text:
            detail = err_text.splitlines()[-1] if err_text else f"退出码 {proc.returncode}"
            return error_result(f"无法启动原生选择窗口: {detail}")
    except subprocess.TimeoutExpired:
        return error_result("选择窗口超时，请重试")
    except Exception as e:
        return error_result(f"选择窗口启动失败: {e}")
    return {"status": "cancelled", "path": "", "paths": [], "dir": "", "files": []}


def resolve_selected_files(files: List[str], base_hint: str = "") -> List[Path]:
    """Resolve GUI-selected files to existing absolute paths.

    Native picker results are already absolute.  The browser fallback only has
    filenames, so also try them relative to the chapter folder and repo root.
    """
    resolved: List[Path] = []
    seen = set()
    base = Path(base_hint) if base_hint else None
    for raw in files or []:
        raw = str(raw or "").strip()
        if not raw:
            continue
        p = Path(raw)
        candidates: List[Path] = []
        if p.is_absolute():
            candidates.append(p)
        else:
            if base:
                candidates.append(base / p)
            candidates.append(repo_root / p)
            candidates.append(p)
        for candidate in candidates:
            try:
                if candidate.is_file():
                    key = str(candidate.resolve()).lower()
                    if key not in seen:
                        seen.add(key)
                        resolved.append(candidate.resolve())
                    break
            except OSError:
                continue
    return resolved


def compact_chapter_name(name: str) -> str:
    """第 01 话 -> 第01话, while leaving custom names unchanged."""
    text = str(name or "").strip()
    text = re.sub(r"第\s*(\d+)\s*话", lambda m: f"第{int(m.group(1)):02d}话", text)
    return text or "未命名章节"


class MangaShotHandler(SimpleHTTPRequestHandler):
    """Handles static files for GUI and REST API requests."""

    pipeline: MangaShotPipeline = None
    dist_dir: Path = repo_root / "gui" / "dist"

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path

        if path == "/api/health":
            self.handle_health()
        elif path.startswith("/outputs/"):
            # Serve generated output files (handle unquoted UTF-8 paths like Chinese/Japanese series titles)
            rel_path = path[len("/outputs/"):]
            rel_path = urllib.parse.unquote(rel_path)
            file_path = repo_root / "outputs" / rel_path
            self.serve_file(file_path)
        else:
            # Serve GUI static dist
            file_path = self.dist_dir / path.lstrip("/")
            if file_path.is_file():
                self.serve_file(file_path)
            else:
                # SPA fallback to index.html
                index_file = self.dist_dir / "index.html"
                if index_file.is_file():
                    self.serve_file(index_file)
                else:
                    self.send_error(404, "GUI dist not built. Run 'npm run build' in gui/")

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path

        if path == "/api/process":
            self.handle_process()
        elif path == "/api/batch":
            self.handle_batch()
        elif path == "/api/browse_dir":
            self.handle_browse_dir()
        elif path == "/api/browse_files":
            self.handle_browse_files()
        elif path == "/api/inspect_dir":
            self.handle_inspect_dir()
        elif path == "/api/infer_title":
            self.handle_infer_title()
        else:
            self.send_error(404, f"API endpoint '{path}' not found")

    def handle_health(self):
        comfy_online = False
        try:
            comfy_online = self.pipeline.colorizer.check_connection()
        except Exception:
            pass

        data = {
            "api": True,
            "model": self.pipeline.cfg["api"]["model"],
            "comfyui": comfy_online,
            "cuda": True,
        }
        self.send_json(data)

    def handle_browse_dir(self):
        content_len = int(self.headers.get("Content-Length", 0))
        initial_dir = None
        if content_len > 0:
            try:
                body = self.rfile.read(content_len).decode("utf-8")
                req = json.loads(body)
                initial_dir = req.get("current")
            except Exception:
                pass

        result = run_picker_process("dir", initial_dir)
        self.send_json(result)

    def handle_browse_files(self):
        content_len = int(self.headers.get("Content-Length", 0))
        initial_dir = None
        if content_len > 0:
            try:
                body = self.rfile.read(content_len).decode("utf-8")
                req = json.loads(body)
                initial_dir = req.get("current")
            except Exception:
                pass

        result = run_picker_process("files", initial_dir)
        if result.get("status") == "success" and result.get("files"):
            import re
            nums = []
            for fn in result["files"]:
                m = re.findall(r"\d+", Path(fn).stem)
                if m:
                    nums.append(int(m[-1]))
            nums.sort()

            range_str = "*"
            if nums:
                min_n = nums[0]
                max_n = nums[-1]
                if len(nums) >= 2 and max_n - min_n == len(nums) - 1:
                    range_str = f"{min_n:02d}-{max_n:02d}"
                else:
                    range_str = ", ".join(f"{n:02d}" for n in nums)
            result["range"] = range_str
        else:
            result["range"] = "*"

        self.send_json(result)

    def handle_inspect_dir(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        req = json.loads(body)
        target_dir = req.get("dir", "")
        p = Path(target_dir) if Path(target_dir).is_absolute() else repo_root / target_dir

        if not p.is_dir():
            self.send_json({"status": "error", "message": f"目录不存在: {p}"})
            return

        import re
        valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        files = sorted([f.name for f in p.iterdir() if f.is_file() and f.suffix.lower() in valid_exts])
        
        nums = []
        for f in files:
            m = re.findall(r"\d+", Path(f).stem)
            if m:
                nums.append(int(m[-1]))
        
        range_str = "*"
        if nums:
            min_n = min(nums)
            max_n = max(nums)
            range_str = f"{min_n:02d}-{max_n:02d}"

        self.send_json({
            "status": "success",
            "count": len(files),
            "range": range_str,
            "files": files[:20],
        })

    def handle_infer_title(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        req = json.loads(body)
        paths = req.get("paths", [])
        title = infer_main_title(
            paths,
            base_url=self.pipeline.cfg["api"]["base_url"],
            api_key=self.pipeline.cfg["api"]["api_key"],
            primary_model=self.pipeline.cfg["api"]["model"],
            fallback_model="claude-sonnet-4-6",
        )
        self.send_json({"status": "success", "title": title})

    def handle_process(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        req = json.loads(body)

        in_path = req.get("input", "example/002.jpg")
        if not Path(in_path).is_absolute():
            in_path = repo_root / in_path

        ref_path = req.get("reference")
        if ref_path and not Path(ref_path).is_absolute():
            ref_path = repo_root / ref_path

        mode = req.get("mode", "auto")
        color_mode = req.get("color_mode", "composite")

        main_title = req.get("main_title")
        if not main_title:
            main_title = infer_main_title(
                [str(in_path)],
                base_url=self.pipeline.cfg["api"]["base_url"],
                api_key=self.pipeline.cfg["api"]["api_key"],
                primary_model=self.pipeline.cfg["api"]["model"],
                fallback_model="claude-sonnet-4-6",
            )

        out_dir = repo_root / "outputs" / main_title / "单页"
        out_dir.mkdir(parents=True, exist_ok=True)

        out_file = out_dir / f"{Path(in_path).stem}.png"
        qa_file = out_dir / "qa" / f"{Path(in_path).stem}_compare.jpg"
        json_file = out_dir / "json" / f"{Path(in_path).stem}.json"

        try:
            res = self.pipeline.process_page(
                img_path=in_path,
                output_path=out_file,
                reference=ref_path,
                mode=mode,
                qa_path=qa_file,
                json_path=json_file,
                color_mode=color_mode,
            )

            # Load generated JSON items
            items = []
            if json_file.is_file():
                meta = json.loads(json_file.read_text(encoding="utf-8"))
                items = meta.get("bubbles", [])

            rel_dir = out_dir.relative_to(repo_root / "outputs").as_posix()
            stem = Path(in_path).stem
            response_data = {
                "page": Path(in_path).name,
                "action": res.get("action", mode),
                "bubbles": res.get("bubbles", len(items)),
                "seconds": res.get("seconds", 0.0),
                "output": str(out_file),
                "qa_url": f"/outputs/{urllib.parse.quote(rel_dir)}/qa/{stem}_compare.jpg",
                "final_url": f"/outputs/{urllib.parse.quote(rel_dir)}/{stem}.png",
                "items": items,
            }
            self.send_json(response_data)
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            self.send_error_json(500, f"Processing error: {e}")

    def handle_batch(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        req = json.loads(body)

        raw_input = req.get("input") or ""
        in_dir = Path(raw_input) if raw_input else repo_root
        if not in_dir.is_absolute():
            in_dir = repo_root / in_dir

        ref_path = req.get("reference")
        if ref_path and not Path(ref_path).is_absolute():
            ref_path = repo_root / ref_path

        mode = req.get("mode", "auto")
        color_mode = req.get("color_mode", "composite")
        page_range = req.get("page_range")
        glob_pattern = req.get("glob", "*.jpg")
        force = req.get("force", False)
        selected_files = req.get("selected_files") or []
        extra_groups = req.get("extra_groups") or []

        # 3. Main title inferred via LLM (gemini-3.8-flash-tiered with fallback to claude-sonnet-4-6)
        main_title = req.get("main_title")
        if not main_title:
            all_paths = req.get("all_paths") or [str(in_dir)]
            main_title = infer_main_title(
                all_paths,
                base_url=self.pipeline.cfg["api"]["base_url"],
                api_key=self.pipeline.cfg["api"]["api_key"],
                primary_model=self.pipeline.cfg["api"]["model"],
                fallback_model="claude-sonnet-4-6",
            )

        chapter_name = req.get("chapter_name") or in_dir.name or "未命名章节"
        out_dir = repo_root / "outputs" / main_title / chapter_name
        out_dir.mkdir(parents=True, exist_ok=True)

        try:
            resolved_pages = resolve_selected_files(selected_files, str(in_dir))
            if selected_files and not resolved_pages:
                raise ValueError("选中的图片文件均不存在，请重新使用图片选择器选取")

            summary: List[Dict[str, Any]] = []
            output_dirs: List[Path] = []
            group_folder_names: List[str] = []
            has_main_input = bool(raw_input.strip()) or bool(resolved_pages)
            if not has_main_input and not extra_groups:
                raise ValueError("未指定章节目录，也没有选择任何图片")

            # Main chapter: discrete picks take precedence over directory range.
            if has_main_input:
                chapter_summary = self.pipeline.process_batch(
                    input_dir=in_dir,
                    output_dir=out_dir,
                    reference=ref_path,
                    mode=mode,
                    glob_pattern=glob_pattern,
                    page_range=None if resolved_pages else page_range,
                    color_mode=color_mode,
                    force=force,
                    explicit_pages=resolved_pages or None,
                )
                for it in chapter_summary:
                    it["chapter_name"] = chapter_name
                    it["source"] = "chapter"
                summary.extend(chapter_summary)
                output_dirs.append(out_dir)

            # Cross-directory page groups all belong to the chapter above them.
            compact_name = compact_chapter_name(chapter_name)
            for group_idx, group in enumerate(extra_groups, 1):
                group_files = group.get("files") or []
                group_dir = group.get("dir") or raw_input
                resolved_group = resolve_selected_files(group_files, str(group_dir or in_dir))
                if not resolved_group:
                    print(f"[Warning] Cross-dir group {group_idx} has no valid files, skipped.")
                    continue

                group_folder = f"{compact_name}-跨目录选页{group_idx:02d}"
                group_out_dir = repo_root / "outputs" / main_title / group_folder
                group_out_dir.mkdir(parents=True, exist_ok=True)

                group_input_dir = Path(group_dir) if group_dir else resolved_group[0].parent
                if not group_input_dir.is_absolute():
                    group_input_dir = repo_root / group_input_dir

                group_summary = self.pipeline.process_batch(
                    input_dir=group_input_dir,
                    output_dir=group_out_dir,
                    reference=ref_path,
                    mode=mode,
                    page_range=None,
                    color_mode=color_mode,
                    force=force,
                    explicit_pages=resolved_group,
                )
                for it in group_summary:
                    it["chapter_name"] = group_folder
                    it["source"] = "cross_dir"
                    it["group_name"] = group_folder
                summary.extend(group_summary)
                output_dirs.append(group_out_dir)
                group_folder_names.append(group_folder)

            # Generate one contact sheet per output folder.
            contact_sheets = []
            for output_dir in output_dirs:
                try:
                    sheet_file = output_dir / "contact_sheet.jpg"
                    create_contact_sheet(output_dir, sheet_file)
                    rel_dir = output_dir.relative_to(repo_root / "outputs").as_posix()
                    contact_sheets.append(f"/outputs/{urllib.parse.quote(rel_dir)}/contact_sheet.jpg")
                except Exception as e:
                    print(f"[Warning] Failed to generate contact sheet: {e}")
                    contact_sheets.append("")

            # Attach output URLs relative to each actual output folder.
            for it in summary:
                folder_name = it.get("chapter_name") or chapter_name
                rel_dir = f"{main_title}/{folder_name}"
                stem = Path(it.get("page", "")).stem
                if stem:
                    it["final_url"] = f"/outputs/{urllib.parse.quote(rel_dir)}/{stem}.png"
                    it["qa_url"] = f"/outputs/{urllib.parse.quote(rel_dir)}/qa/{stem}_compare.jpg"

            rel_sheet = f"{main_title}/{chapter_name}/contact_sheet.jpg"
            self.send_json({
                "status": "success",
                "summary": summary,
                "main_title": main_title,
                "chapter_name": chapter_name,
                "contact_sheet_url": contact_sheets[0] if contact_sheets else f"/outputs/{urllib.parse.quote(rel_sheet)}",
                "contact_sheets": contact_sheets,
                "cross_dir_groups": group_folder_names,
            })
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            self.send_error_json(500, f"Batch processing error: {e}")

    def serve_file(self, file_path: Path):
        if not file_path.is_file():
            self.send_error_json(404, f"File '{file_path.name}' not found")
            return

        ext = file_path.suffix.lower()
        if ext == ".js":
            mime_type = "application/javascript; charset=utf-8"
        elif ext == ".css":
            mime_type = "text/css; charset=utf-8"
        elif ext == ".html":
            mime_type = "text/html; charset=utf-8"
        elif ext in (".jpg", ".jpeg"):
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".json":
            mime_type = "application/json; charset=utf-8"
        else:
            mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

        try:
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"Error serving file: {e}")

    def send_error_json(self, code: int, message: str):
        try:
            body = json.dumps({"status": "error", "message": str(message)}, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass

    def send_json(self, data: dict):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[GUI Server] {args[0]} - {args[1]}\n")


def run_server(host: str = "127.0.0.1", port: int = 7860, config_path: str = "config.example.json"):
    pipeline = MangaShotPipeline(config_path=config_path, lazy_models=True)
    MangaShotHandler.pipeline = pipeline

    server = HTTPServer((host, port), MangaShotHandler)
    print("==================================================")
    print(f"  MangaShot GUI Server started at http://{host}:{port}")
    print("  Serving TypeScript UI from gui/dist")
    print("  Press Ctrl+C to terminate server.")
    print("==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MangaShot GUI server.")
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start MangaShot Web GUI Server.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", "-p", type=int, default=7860, help="Port (default: 7860)")
    parser.add_argument("--config", "-c", default="config.example.json", help="Path to config")
    args = parser.parse_args()
    run_server(args.host, args.port, args.config)
