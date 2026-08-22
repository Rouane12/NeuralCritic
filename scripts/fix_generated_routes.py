#!/usr/bin/env python3
"""Post-process generated Neural Critic routes for safe runtime hydration.

SEO/social metadata lives in <head>, so the generated route does not need to
pre-populate #article with a miniature fallback body. Doing so makes the
article enhancement scripts believe the real article has already rendered,
which races the CMS renderer and leaves pretty routes partially enhanced.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / ".generated-routes.json"


def main() -> int:
    if not MANIFEST.exists():
        print("No generated-route manifest found; nothing to post-process.")
        return 0

    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files = payload.get("files", []) if isinstance(payload, dict) else []
    changed = 0

    for relative in files:
        path = ROOT / str(relative)
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        next_text, count = re.subn(
            r'<main class="article-page" id="article">.*?</main>',
            '<main class="article-page" id="article"></main>',
            text,
            count=1,
            flags=re.S,
        )
        if count and next_text != text:
            path.write_text(next_text, encoding="utf-8")
            changed += 1

    print(f"Prepared {changed} generated routes for clean runtime hydration.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
