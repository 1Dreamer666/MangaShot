import requests
import json
import time
from pathlib import Path

def main():
    repo_root = Path(__file__).resolve().parent.parent
    payload = {
        "input": "examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）",
        "reference": "examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_001.jpg",
        "mode": "advanced",
        "color_mode": "composite",
        "page_range": "05-19",
        "glob": "*.jpg",
        "force": True,
    }

    url = "http://127.0.0.1:7860/api/batch"
    print(f"[GUI Simulation] Sending POST request to {url}")
    print(f"[GUI Simulation] Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")

    t0 = time.time()
    try:
        resp = requests.post(url, json=payload, timeout=900)
    except Exception as e:
        print(f"[GUI Simulation] Request failed: {e}")
        return

    elapsed = time.time() - t0
    print(f"\n[GUI Simulation] Response Status Code: {resp.status_code} (in {elapsed:.2f}s)")
    if resp.status_code == 200:
        data = resp.json()
        summary = data.get("summary", [])
        print(f"[GUI Simulation] Batch successfully finished! Total pages: {len(summary)}")
        for idx, item in enumerate(summary, 1):
            p_name = item.get("page", "unknown")
            action = item.get("action", "unknown")
            sec = item.get("seconds", 0.0)
            bubbles = item.get("bubbles", 0)
            print(f"  [{idx:02d}/{len(summary):02d}] {p_name} -> {action} ({sec:.2f}s, {bubbles} bubbles)")
    else:
        print(f"[GUI Simulation] Error response: {resp.text}")

if __name__ == "__main__":
    main()
