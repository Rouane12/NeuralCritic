#!/usr/bin/env python3
"""Regression audit for Neural Critic social/link preview metadata.

This is intentionally network-free. It validates the HTML social metadata that
WhatsApp, Discord, Facebook, X and other unfurlers can read before JavaScript.
"""

from __future__ import annotations

import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://www.neuralcritic.net"
HOME_SOCIAL_PATH = "/images/brand/neural-critic-social-card.png"
EXPECTED_SOCIAL_SIZE = (1200, 630)
EXPECTED_LOGO_SIZE = (512, 512)


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.links: dict[str, list[str]] = {}
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "meta":
            key = (data.get("property") or data.get("name") or "").strip().lower()
            if key and key not in self.meta:
                self.meta[key] = data.get("content", "").strip()
        elif tag.lower() == "link":
            rel = data.get("rel", "").strip().lower()
            href = data.get("href", "").strip()
            if rel and href:
                self.links.setdefault(rel, []).append(href)
        elif tag.lower() == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def parse_html(path: Path) -> tuple[str, HeadParser]:
    text = path.read_text(encoding="utf-8", errors="replace")
    parser = HeadParser()
    parser.feed(text)
    parser.title = parser.title.strip()
    return text, parser


def png_dimensions(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", header[16:24])


def local_asset(url: str) -> Path | None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc not in {"www.neuralcritic.net", "neuralcritic.net"}:
        return None
    return ROOT / parsed.path.lstrip("/")


def check(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_image_url(label: str, url: str, errors: list[str]) -> None:
    parsed = urlparse(url)
    check(parsed.scheme == "https" and bool(parsed.netloc), f"{label}: preview image must be an absolute HTTPS URL", errors)
    asset = local_asset(url)
    if asset is not None:
        check(asset.exists(), f"{label}: local preview image does not exist: {asset.relative_to(ROOT)}", errors)


def validate_common(path: Path, *, require_image: bool, strict_home: bool = False) -> tuple[list[str], list[str]]:
    text, head = parse_html(path)
    label = str(path.relative_to(ROOT))
    errors: list[str] = []
    warnings: list[str] = []

    check("rouane12.github.io" not in text.lower(), f"{label}: old GitHub Pages hostname leaked into page metadata", errors)
    check(bool(head.title), f"{label}: missing <title>", errors)
    check(bool(head.meta.get("description")), f"{label}: missing meta description", errors)
    check(head.meta.get("og:site_name") == "Neural Critic", f"{label}: missing/incorrect og:site_name", errors)
    check(bool(head.meta.get("og:title")), f"{label}: missing og:title", errors)
    check(bool(head.meta.get("og:description")), f"{label}: missing og:description", errors)
    check(bool(head.meta.get("og:url")), f"{label}: missing og:url", errors)
    check(bool(head.links.get("canonical")), f"{label}: missing canonical link", errors)
    check(bool(head.meta.get("twitter:card")), f"{label}: missing twitter:card", errors)
    check(bool(head.meta.get("twitter:title")), f"{label}: missing twitter:title", errors)
    check(bool(head.meta.get("twitter:description")), f"{label}: missing twitter:description", errors)

    og_url = head.meta.get("og:url", "")
    canonical = (head.links.get("canonical") or [""])[0]
    if og_url:
        check(og_url.startswith(SITE_ORIGIN), f"{label}: og:url is not on neuralcritic.net", errors)
    if canonical:
        check(canonical.startswith(SITE_ORIGIN), f"{label}: canonical is not on neuralcritic.net", errors)
    if og_url and canonical:
        check(og_url == canonical, f"{label}: og:url and canonical disagree", errors)

    image = head.meta.get("og:image", "")
    if require_image:
        check(bool(image), f"{label}: missing og:image", errors)
        check(bool(head.meta.get("og:image:alt")), f"{label}: missing og:image:alt", errors)
        check(bool(head.meta.get("twitter:image")), f"{label}: missing twitter:image", errors)
        check(bool(head.meta.get("twitter:image:alt")), f"{label}: missing twitter:image:alt", errors)
        if image:
            validate_image_url(label, image, errors)
        secure = head.meta.get("og:image:secure_url", "")
        if secure:
            check(secure == image, f"{label}: og:image:secure_url differs from og:image", errors)
        elif path.parts[-3:-2] == ("stories",):
            warnings.append(f"{label}: story has no og:image:secure_url")

    if strict_home:
        check(head.meta.get("og:type") == "website", f"{label}: homepage og:type must be website", errors)
        check(og_url == f"{SITE_ORIGIN}/", f"{label}: homepage og:url must be canonical root", errors)
        check(canonical == f"{SITE_ORIGIN}/", f"{label}: homepage canonical must be canonical root", errors)
        check(head.meta.get("twitter:card") == "summary_large_image", f"{label}: homepage must use summary_large_image", errors)
        check(head.meta.get("og:image:type") == "image/png", f"{label}: homepage og:image:type must be image/png", errors)
        check(head.meta.get("og:image:width") == "1200", f"{label}: homepage og:image:width must be 1200", errors)
        check(head.meta.get("og:image:height") == "630", f"{label}: homepage og:image:height must be 630", errors)
        check(head.meta.get("og:image:url") == image, f"{label}: homepage og:image:url should mirror og:image", errors)
        check((head.links.get("image_src") or [""])[0] == image, f"{label}: homepage image_src should mirror og:image", errors)
        check(urlparse(image).path == HOME_SOCIAL_PATH, f"{label}: homepage should use the branded social card", errors)

    return errors, warnings


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    home_errors, home_warnings = validate_common(ROOT / "index.html", require_image=True, strict_home=True)
    errors.extend(home_errors)
    warnings.extend(home_warnings)

    category = ROOT / "category.html"
    if category.exists():
        page_errors, page_warnings = validate_common(category, require_image=True)
        errors.extend(page_errors)
        warnings.extend(page_warnings)

    story_pages = sorted((ROOT / "stories").glob("*/index.html")) if (ROOT / "stories").exists() else []
    for page in story_pages:
        page_errors, page_warnings = validate_common(page, require_image=True)
        errors.extend(page_errors)
        warnings.extend(page_warnings)
        _, head = parse_html(page)
        label = str(page.relative_to(ROOT))
        check(head.meta.get("og:type") == "article", f"{label}: story og:type must be article", errors)
        check(head.meta.get("twitter:card") == "summary_large_image", f"{label}: story must use summary_large_image", errors)

    # Topic and author hubs should unfurl when they have an image. Their image can
    # legitimately be absent, so these are audited for metadata consistency but do
    # not fail solely because an image is unavailable.
    for pattern in ("topics/*/*/index.html", "authors/*/index.html"):
        for page in sorted(ROOT.glob(pattern)):
            text, head = parse_html(page)
            label = str(page.relative_to(ROOT))
            if "rouane12.github.io" in text.lower():
                errors.append(f"{label}: old GitHub Pages hostname leaked into page metadata")
            if head.meta.get("og:image"):
                validate_image_url(label, head.meta["og:image"], errors)
                if not head.meta.get("twitter:image"):
                    errors.append(f"{label}: has og:image but no twitter:image")
            if not head.meta.get("og:title") or not head.meta.get("og:url"):
                errors.append(f"{label}: incomplete Open Graph metadata")

    social_card = ROOT / HOME_SOCIAL_PATH.lstrip("/")
    logo = ROOT / "images/brand/neural-critic-logo-512.png"
    check(png_dimensions(social_card) == EXPECTED_SOCIAL_SIZE, "Brand social card must be a valid 1200×630 PNG", errors)
    check(png_dimensions(logo) == EXPECTED_LOGO_SIZE, "Brand logo must be a valid 512×512 PNG", errors)

    print(f"Social preview QA: homepage + category + {len(story_pages)} story shells checked.")
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Social preview QA FAILED with {len(errors)} issue(s).", file=sys.stderr)
        return 1

    print("Social preview QA PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
