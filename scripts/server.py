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
import sys
import urllib.parse

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from mangashot.pipeline import MangaShotPipeline, DEFAULT_CONFIG


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
            # Serve generated output files
            rel_path = path[len("/outputs/"):]
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
        out_dir = repo_root / "outputs" / "gui_run"
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

            response_data = {
                "page": Path(in_path).name,
                "action": res.get("action", mode),
                "bubbles": res.get("bubbles", len(items)),
                "seconds": res.get("seconds", 0.0),
                "output": str(out_file),
                "qa_url": f"/outputs/gui_run/qa/{Path(in_path).stem}_compare.jpg",
                "final_url": f"/outputs/gui_run/{Path(in_path).stem}.png",
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

        in_dir = req.get("input")
        if not Path(in_dir).is_absolute():
            in_dir = repo_root / in_dir

        ref_path = req.get("reference")
        if ref_path and not Path(ref_path).is_absolute():
            ref_path = repo_root / ref_path

        mode = req.get("mode", "auto")
        color_mode = req.get("color_mode", "composite")
        page_range = req.get("page_range")
        glob_pattern = req.get("glob", "*.jpg")
        out_dir = repo_root / "outputs" / "gui_batch"

        try:
            summary = self.pipeline.process_batch(
                input_dir=in_dir,
                output_dir=out_dir,
                reference=ref_path,
                mode=mode,
                glob_pattern=glob_pattern,
                page_range=page_range,
                color_mode=color_mode,
            )
            self.send_json({"status": "success", "summary": summary})
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
            mime_type = "application/javascript"
        elif ext == ".css":
            mime_type = "text/css"
        elif ext == ".html":
            mime_type = "text/html"
        elif ext in (".jpg", ".jpeg"):
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".json":
            mime_type = "application/json"
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
        except Exception:
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
        except (ConnectionResetError, BrokenPipeError):
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
