#!/usr/bin/env python3
"""Poll the live site until a published story is safe to distribute."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "assets" / "app.js"
ROUTER = ROOT / "assets" / "story-router.js"
SITE_URL = "https://www.neuralcritic.net/"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def fetch(url: str, timeout: int = 20) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "NeuralCritic-LiveStoryProbe/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return int(response.status), response.read().decode("utf-8")


def validate(slug: str) -> list[str]:
    canonical = f"{SITE_URL}stories/{urllib.parse.quote(slug, safe='-._~')}/"
    detail_url = f"{SITE_URL}data/articles/{urllib.parse.quote(slug, safe='-._~')}.json"
    failures: list[str] = []

    try:
        status, html = fetch(canonical)
    except Exception as exc:
        return [f"canonical request failed: {exc}"]
    if status != 200:
        failures.append(f"canonical returned HTTP {status}")
        return failures

    expected_app = f'assets/app.js?v={digest(APP)}'
    expected_router = f'assets/story-router.js?v={digest(ROUTER)}'
    required_html = {
        "canonical link": f'<link rel="canonical" href="{canonical}">',
        "static slug": f"window.NEURAL_CRITIC_STATIC_SLUG={json.dumps(slug)}",
        "current app runtime": expected_app,
        "canonical story router": expected_router,
        "Open Graph title": '<meta property="og:title"',
    }
    for label, marker in required_html.items():
        if marker not in html:
            failures.append(f"missing {label}")

    if "article.html?slug=" in canonical:
        failures.append("canonical URL resolved to a legacy article URL")

    try:
        detail_status, raw_detail = fetch(detail_url)
        detail = json.loads(raw_detail)
    except Exception as exc:
        failures.append(f"runtime article fallback failed: {exc}")
        return failures

    if detail_status != 200:
        failures.append(f"runtime article fallback returned HTTP {detail_status}")
        return failures
    if not isinstance(detail, dict):
        failures.append("runtime article fallback is not an object")
        return failures
    if str(detail.get("slug") or "").strip() != slug:
        failures.append("runtime article fallback slug mismatch")
    if not str(detail.get("title") or "").strip():
        failures.append("runtime article fallback has no title")

    body = str(detail.get("body") or "").strip()
    blocks = detail.get("contentBlocks") if isinstance(detail.get("contentBlocks"), list) else []
    if not body and not any(isinstance(block, dict) and str(block.get("text") or "").strip() for block in blocks):
        failures.append("runtime article fallback has no renderable article body")

    image = str(detail.get("imageLocal") or detail.get("image") or "").strip()
    if image and '<meta property="og:image"' not in html:
        failures.append("story has an image but canonical shell has no Open Graph image")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--interval", type=int, default=8)
    args = parser.parse_args()

    slug = str(args.slug or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug):
        parser.error("invalid story slug")

    deadline = time.monotonic() + max(0, args.timeout)
    attempt = 0
    last_failures: list[str] = []
    while True:
        attempt += 1
        last_failures = validate(slug)
        if not last_failures:
            print(f"LIVE STORY READY: {slug} passed canonical shell, runtime, body, and social metadata checks on attempt {attempt}.")
            return 0

        print(f"Live story probe attempt {attempt} not ready: {'; '.join(last_failures)}")
        if time.monotonic() >= deadline:
            break
        time.sleep(max(1, args.interval))

    print(f"LIVE STORY NOT READY: {slug}: {'; '.join(last_failures)}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
