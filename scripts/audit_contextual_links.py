#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

checks = {
    "article.html": [
        "assets/article-links.css?v=20260922-links1",
        "assets/article-links.js?v=20260922-links1",
    ],
    "studio.html": [
        "assets/studio-links.css?v=20260922-links1",
        "assets/studio-links.js?v=20260922-links1",
    ],
    "assets/app.js": [
        "storySlugFromTarget",
        "nc-context-link nc-link-internal",
        "relatedStorySlug",
        "nc-related-story",
    ],
    "assets/studio.js": [
        'data-field="relatedStorySlug"',
        "RELATED STORY CARD",
    ],
    "assets/article-links.js": [
        "data-nc-story-link",
        "editorial_context_click",
    ],
    "assets/studio-links.js": [
        "LINK STORY",
        "LINK SOURCE",
        "story:",
        "relatedStorySlug",
    ],
}

failures = []
for rel, markers in checks.items():
    path = ROOT / rel
    if not path.exists():
        failures.append(f"{rel}: missing file")
        continue
    text = path.read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            failures.append(f"{rel}: missing marker {marker!r}")

if failures:
    print("Contextual editorial link audit failed:")
    for failure in failures:
        print(f" - {failure}")
    raise SystemExit(1)

print("Contextual editorial link audit passed.")
