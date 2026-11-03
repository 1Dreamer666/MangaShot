# -*- coding: utf-8 -*-
"""
Native Windows file and directory picker using Tkinter.

Run this as a standalone subprocess so the Tk event loop never blocks (or
crashes) the HTTP server.  The result is always written to stdout as one
UTF-8 JSON object, which keeps Chinese/Japanese paths intact on Windows.
"""
import json
import os
import sys
import traceback


def _write_result(result: dict) -> None:
    data = json.dumps(result, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "dir"
    init_dir = sys.argv[2] if len(sys.argv) > 2 else ""

    # A hidden self-test mode lets the server verify the subprocess plumbing
    # without opening a modal dialog.
    if mode == "selftest":
        _write_result({
            "status": "success",
            "paths": [os.path.abspath(__file__)],
            "dir": os.path.dirname(os.path.abspath(__file__)),
            "files": [os.path.basename(__file__)],
            "path": os.path.abspath(__file__),
        })
        return

    if not init_dir or not os.path.isdir(init_dir):
        init_dir = ""

    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        try:
            root.wm_attributes("-topmost", 1)
        except Exception:
            pass

        try:
            if mode == "dir":
                kwargs = {
                    "parent": root,
                    "title": "选择漫画章节文件夹",
                }
                if init_dir:
                    kwargs["initialdir"] = init_dir
                path = filedialog.askdirectory(**kwargs)
                if path:
                    result = {"status": "success", "path": os.path.normpath(path)}
                else:
                    result = {"status": "cancelled", "path": ""}
            elif mode == "files":
                kwargs = {
                    "parent": root,
                    "title": "选择漫画图片 (可按住 Ctrl 或 Shift 多选)",
                    "filetypes": [
                        ("漫画图片", "*.jpg;*.jpeg;*.png;*.webp;*.bmp"),
                        ("所有文件", "*.*"),
                    ],
                }
                if init_dir:
                    kwargs["initialdir"] = init_dir
                paths = filedialog.askopenfilenames(**kwargs)
                if paths:
                    norm_paths = [os.path.normpath(p) for p in paths]
                    result = {
                        "status": "success",
                        "paths": norm_paths,
                        "dir": os.path.dirname(norm_paths[0]),
                        "files": [os.path.basename(p) for p in norm_paths],
                    }
                else:
                    result = {
                        "status": "cancelled",
                        "paths": [],
                        "dir": "",
                        "files": [],
                    }
            else:
                result = {
                    "status": "error",
                    "message": f"Unknown picker mode: {mode}",
                    "paths": [],
                    "dir": "",
                    "files": [],
                }
        finally:
            try:
                root.destroy()
            except Exception:
                pass
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        result = {
            "status": "error",
            "message": str(exc),
            "paths": [],
            "dir": "",
            "files": [],
        }

    _write_result(result)


if __name__ == "__main__":
    main()
