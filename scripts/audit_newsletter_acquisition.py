#!/usr/bin/env python3
"""Fail if Neural Critic's public newsletter capture becomes disconnected or misleading."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWSLETTER = ROOT / "assets" / "newsletter.js"
CONFIG = ROOT / "assets" / "supabase-config.js"
INDEX = ROOT / "index.html"
CATEGORY = ROOT / "category.html"
ARTICLE_EXTRAS = ROOT / "assets" / "article-extras.js"
PRIVACY = ROOT / "privacy.html"


def fail(message: str) -> None:
    raise SystemExit(f"NEWSLETTER ACQUISITION FAILED: {message}")


def text(path: Path) -> str:
    if not path.exists():
        fail(f"missing required file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(haystack: str, marker: str, message: str) -> None:
    if marker not in haystack:
        fail(message)


def main() -> int:
    newsletter = text(NEWSLETTER)
    config = text(CONFIG)
    index = text(INDEX)
    category = text(CATEGORY)
    article_extras = text(ARTICLE_EXTRAS)
    privacy = text(PRIVACY)

    require(newsletter, "/functions/v1/public-actions", "signup handler no longer targets the hardened public-actions Edge Function")
    require(newsletter, "action: 'subscribe'", "signup handler no longer uses the deployed newsletter subscribe action")
    require(newsletter, "'apikey': config.publishableKey", "signup handler no longer authenticates with the public publishable key")
    require(newsletter, "event.stopImmediatePropagation()", "newsletter capture no longer blocks legacy fake-success submit handlers")
    require(newsletter, "location.pathname.match(/\\/stories\\/", "canonical /stories/<slug>/ source attribution is missing")
    require(newsletter, "neuralcritic:newsletter-subscribed", "successful signup event is missing")
    if ".rpc('subscribe_newsletter'" in newsletter or '.rpc("subscribe_newsletter"' in newsletter:
        fail("public newsletter handler regressed to direct database RPC usage")

    require(config, "assets/newsletter.js?v=20260901-newsletter1", "shared public config no longer autoloads the newsletter handler")
    require(config, "data-nc-newsletter", "newsletter autoload does not have a duplicate-load guard")
    require(config, "loadNewsletter();", "newsletter loader is declared but not activated")

    require(index, "id=\"weekly-drop\"", "homepage Weekly Drop acquisition surface is missing")
    require(category, "id=\"category-newsletter\"", "category newsletter acquisition surface is missing")
    require(article_extras, "data-side-newsletter", "article sidebar newsletter acquisition surface is missing")
    require(article_extras, "work-weekly-card", "article Weekly Drop acquisition surface is missing")

    require(privacy, "<h2>Newsletter data</h2>", "privacy policy no longer discloses newsletter data handling")
    require(privacy, "email address you submit", "privacy newsletter disclosure no longer describes collected email data")

    print("Newsletter acquisition audit passed: public signup surfaces share the hardened Edge capture path.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
