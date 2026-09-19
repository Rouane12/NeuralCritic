#!/usr/bin/env python3
"""Broad static integrity audit for Neural Critic public surfaces.

This intentionally complements the specialized publication audits. It catches
generic site regressions that are easy to miss when individual features are
tested in isolation: missing local assets, duplicate static IDs/scripts,
broken local article images, and unsupported embedded video URLs.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {".git", ".github", "node_modules", "__pycache__"}
PUBLIC_HTML = [
    ROOT / "index.html",
    ROOT / "article.html",
    ROOT / "category.html",
    ROOT / "search.html",
    ROOT / "game.html",
    ROOT / "topic.html",
    ROOT / "author.html",
    ROOT / "deals.html",
    ROOT / "about.html",
    ROOT / "standards.html",
    ROOT / "commercial.html",
    ROOT / "privacy.html",
    ROOT / "404.html",
    ROOT / "reviews" / "index.html",
    ROOT / "guides" / "index.html",
    ROOT / "games" / "index.html",
]
ARTICLE_INDEX = ROOT / "data" / "articles.json"
ARTICLE_DIR = ROOT / "data" / "articles"
REPOSITORY_INDEX = ROOT / "data" / "repository-articles.json"
MANUAL_ARTICLE_DIR = ROOT / "data" / "manual-articles"
CANONICAL_ARTICLE_RUNTIMES = [
    ROOT / "assets" / "article-extras.js",
    ROOT / "assets" / "article-formatting.js",
    ROOT / "assets" / "ranked-parity.js",
    ROOT / "assets" / "curated-article.js",
    ROOT / "assets" / "community-stable.js",
    ROOT / "assets" / "community-core.js",
    ROOT / "assets" / "community-thread-recovery.js",
]

ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(message: str) -> None:
    ERRORS.append(message)


def warn(message: str) -> None:
    WARNINGS.append(message)


def normalized_asset(value: str) -> str:
    return value.split("?", 1)[0].split("#", 1)[0].strip()


def local_asset_path(page: Path, raw: str, base_href: str) -> Path | None:
    raw = normalized_asset(raw)
    if not raw or raw.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc or raw.startswith("//"):
        return None

    if raw.startswith("/"):
        relative = raw.lstrip("/")
    elif base_href.startswith("/"):
        relative = f"{base_href.strip('/')}/{raw}".strip("/")
    else:
        relative = str((page.parent.relative_to(ROOT) / raw).as_posix())

    parts: list[str] = []
    for part in relative.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)
    return ROOT.joinpath(*parts)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.scripts: list[str] = []
        self.assets: list[tuple[str, str]] = []
        self.base_href = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "base" and values.get("href"):
            self.base_href = values["href"]
        if tag == "script" and values.get("src"):
            self.scripts.append(normalized_asset(values["src"]))
            self.assets.append(("script", values["src"]))
        elif tag == "link" and values.get("href"):
            rel = values.get("rel", "").lower()
            if any(token in rel for token in ("stylesheet", "icon", "manifest")):
                self.assets.append(("link", values["href"]))
        elif tag in {"img", "source"} and values.get("src"):
            self.assets.append((tag, values["src"]))
        elif tag == "video" and values.get("poster"):
            self.assets.append(("poster", values["poster"]))


def audit_html(page: Path) -> None:
    if not page.exists():
        error(f"Missing public entry page: {page.relative_to(ROOT)}")
        return

    parser = PageParser()
    try:
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
    except Exception as exc:
        error(f"{page.relative_to(ROOT)} could not be parsed: {exc}")
        return

    duplicate_ids = sorted(key for key, count in Counter(parser.ids).items() if count > 1)
    if duplicate_ids:
        error(f"{page.relative_to(ROOT)} has duplicate static id(s): {', '.join(duplicate_ids)}")

    duplicate_scripts = sorted(key for key, count in Counter(parser.scripts).items() if key and count > 1)
    if duplicate_scripts:
        error(f"{page.relative_to(ROOT)} loads duplicate script(s): {', '.join(duplicate_scripts)}")

    for kind, raw in parser.assets:
        asset = local_asset_path(page, raw, parser.base_href)
        if asset is None:
            continue
        if not asset.is_file():
            error(f"{page.relative_to(ROOT)} references missing local {kind}: {raw} -> {asset.relative_to(ROOT)}")


def load_articles() -> list[dict]:
    if not ARTICLE_INDEX.exists():
        error("Missing data/articles.json")
        return []
    try:
        rows = json.loads(ARTICLE_INDEX.read_text(encoding="utf-8"))
    except Exception as exc:
        error(f"data/articles.json is invalid JSON: {exc}")
        return []
    if not isinstance(rows, list):
        error("data/articles.json must contain a list")
        return []
    return [row for row in rows if isinstance(row, dict)]


def local_article_asset(value: object) -> Path | None:
    raw = str(value or "").strip()
    if not raw or raw.startswith(("http://", "https://", "data:")):
        return None
    return ROOT / raw.split("?", 1)[0].split("#", 1)[0].lstrip("/")


def video_supported(value: object) -> bool:
    raw = str(value or "").strip()
    if not raw:
        return True
    try:
        parsed = urlsplit(raw)
    except Exception:
        return False
    if parsed.scheme != "https" or not parsed.netloc:
        return False
    host = parsed.netloc.lower().split(":", 1)[0]
    if host in {"youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}:
        return True
    if host == "vimeo.com" or host.endswith(".vimeo.com"):
        return True
    return bool(re.search(r"\.(mp4|webm|ogg)(?:$|[?#])", raw, flags=re.I))


def audit_canonical_slug_ownership() -> None:
    query_pattern = re.compile(r"URLSearchParams\\(location\\.search\\).*?get\\(['\\\"]slug['\\\"]\\)")
    for path in CANONICAL_ARTICLE_RUNTIMES:
        if not path.is_file():
            error(f"Missing canonical article runtime: {path.relative_to(ROOT)}")
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        if not query_pattern.search(source):
            continue
        if "NEURAL_CRITIC_STATIC_SLUG" not in source and "NeuralCriticStoryRouter" not in source:
            error(
                f"{path.relative_to(ROOT)} reads ?slug= without supporting the canonical static story slug"
            )


def audit_repository_publication_index() -> None:
    if not REPOSITORY_INDEX.is_file():
        error("Missing data/repository-articles.json")
        return
    try:
        rows = json.loads(REPOSITORY_INDEX.read_text(encoding="utf-8"))
    except Exception as exc:
        error(f"data/repository-articles.json is invalid JSON: {exc}")
        return
    if not isinstance(rows, list):
        error("data/repository-articles.json must contain a list")
        return

    indexed = {str(row.get("slug") or "") for row in rows if isinstance(row, dict)}
    manual = {path.stem for path in MANUAL_ARTICLE_DIR.glob("*.json")} if MANUAL_ARTICLE_DIR.exists() else set()
    missing = manual - indexed
    if missing:
        error("Repository-published stories missing from public repository index: " + ", ".join(sorted(missing)))

    for row in rows:
        if not isinstance(row, dict):
            continue
        slug = str(row.get("slug") or "")
        image = local_article_asset(row.get("imageLocal"))
        if slug and image is not None and not image.is_file():
            error(f"{slug}: repository index image is missing: {row.get('imageLocal')}")


def audit_articles() -> None:
    rows = load_articles()
    seen: set[str] = set()

    for row in rows:
        slug = str(row.get("slug") or "").strip()
        if not slug:
            error("Published article row is missing a slug")
            continue
        if slug in seen:
            error(f"Duplicate published slug in data/articles.json: {slug}")
        seen.add(slug)

        detail = ARTICLE_DIR / f"{slug}.json"
        if not detail.is_file():
            error(f"{slug}: missing per-story JSON fallback")

        for label, value in (
            ("featured image", row.get("imageLocal")),
            *[
                (f"content block {index + 1} image", block.get("imageLocal"))
                for index, block in enumerate(row.get("contentBlocks") or [])
                if isinstance(block, dict)
            ],
        ):
            asset = local_article_asset(value)
            if asset is not None and not asset.is_file():
                error(f"{slug}: {label} is missing: {value}")

        for index, block in enumerate(row.get("contentBlocks") or []):
            if not isinstance(block, dict):
                continue
            video = block.get("videoUrl")
            if video and not video_supported(video):
                error(f"{slug}: content block {index + 1} has unsupported/insecure video URL: {video}")

        story = ROOT / "stories" / slug / "index.html"
        if not story.is_file():
            error(f"{slug}: canonical story shell is missing")
            continue
        source = story.read_text(encoding="utf-8", errors="replace")
        for asset, expected in (
            ("assets/content-api.js", 1),
            ("assets/recirculation.js", 1),
            ("assets/article-video.js", 1),
        ):
            count = len(re.findall(rf'<script\b[^>]*src=["\'][^"\']*{re.escape(asset)}(?:\?[^"\']*)?["\']', source, flags=re.I))
            if count != expected:
                error(f"{slug}: canonical shell loads {asset} {count} time(s), expected {expected}")


def main() -> int:
    for page in PUBLIC_HTML:
        audit_html(page)
    audit_canonical_slug_ownership()
    audit_repository_publication_index()
    audit_articles()

    for message in WARNINGS:
        print(f"WARNING: {message}")
    for message in ERRORS:
        print(f"ERROR: {message}", file=sys.stderr)

    checked_pages = sum(1 for page in PUBLIC_HTML if page.exists())
    print(
        "Site integrity audit: "
        f"{len(ERRORS)} error(s), {len(WARNINGS)} warning(s); "
        f"entry pages={checked_pages}, articles={len(load_articles())}"
    )
    return 1 if ERRORS else 0


if __name__ == "__main__":
    raise SystemExit(main())
