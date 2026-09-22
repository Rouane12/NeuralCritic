#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
TARGETS = [
    ("home", "/"),
    ("article", "/stories/physint-bill-skarsgard-lead-xbox-tgs-2026/"),
    ("article", "/stories/gen-atlas-fumito-ueda-most-ambitious-world-yet/"),
    ("category", "/category.html?category=latest"),
    ("search", "/search.html"),
    ("game", "/games/elden-ring/"),
]

def chrome_binary() -> str | None:
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    return None

def run_target(chrome: str, kind: str, target: str) -> dict:
    encoded_target = quote(target, safe="/?=&")
    url = (
        f"http://127.0.0.1:{PORT}/scripts/browser_smoke.html"
        f"?kind={quote(kind)}&target={encoded_target}"
    )
    cmd = [
        chrome,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--window-size=1440,1100",
        "--virtual-time-budget=16000",
        "--dump-dom",
        url,
    ]
    completed = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=85)
    output = completed.stdout or ""
    match = re.search(r'<pre id="smoke-result"[^>]*>(.*?)</pre>', output, re.S)
    if not match:
        return {
            "target": target,
            "kind": kind,
            "pass": False,
            "error": "Smoke harness result missing",
            "chrome_stderr": (completed.stderr or "")[-2000:],
        }
    payload = html.unescape(match.group(1))
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        return {
            "target": target,
            "kind": kind,
            "pass": False,
            "error": f"Invalid smoke JSON: {exc}",
            "payload": payload[:2000],
        }

def main() -> int:
    chrome = chrome_binary()
    if not chrome:
        print("No Chrome/Chromium binary available for browser smoke checks.", file=sys.stderr)
        return 2

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1.2)
        results = [run_target(chrome, kind, target) for kind, target in TARGETS]
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()

    failed = False
    for result in results:
        state = "PASS" if result.get("pass") else "FAIL"
        print(f"{state} {result.get('kind')} {result.get('target')}")
        for check in result.get("checks", []):
            print(f"  {'PASS' if check.get('ok') else 'FAIL'} {check.get('name')}: {check.get('value')}")
        if result.get("error"):
            print(f"  ERROR {result['error']}")
        if not result.get("pass"):
            failed = True

    if failed:
        print(json.dumps(results, indent=2))
        return 1

    print(f"Browser smoke suite passed: {len(results)}/{len(results)} routes.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
