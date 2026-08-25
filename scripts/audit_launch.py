#!/usr/bin/env python3
"""Final production launch gate for Neural Critic.

This audit complements audit_publication_v2.py with release-sensitive checks for
local references, private CMS isolation, accessibility/performance telemetry,
commercial safety locks, canonical author identity, account hardening, and CI coverage.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import audit_publication as base
from publication_config import BASE_PATH, public_path

ROOT = Path(__file__).resolve().parents[1]

ROOT_HTML = (
    "index.html",
    "article.html",
    "category.html",
    "search.html",
    "topic.html",
    "author.html",
    "about.html",
    "privacy.html",
    "standards.html",
    "commercial.html",
    "404.html",
    "studio.html",
    "subscribers.html",
    "newsroom.html",
)
PRIVATE_PAGES = ("studio.html", "subscribers.html", "newsroom.html")
LOCAL_REF_RE = re.compile(r"(?:src|href)=[\"']([^\"']+)[\"']", re.I)
DYNAMIC_ASSET_RE = re.compile(r"assets/[A-Za-z0-9_./-]+\.(?:js|css)(?:\?[^\"'\s]*)?")
STRUCTURED_DATA_RE = re.compile(
    r'<script\s+id="nc-structured-data"\s+type="application/ld\+json">(.*?)</script>',
    re.S,
)


def local_target(page: Path, raw_ref: str) -> Path | None:
    ref = raw_ref.strip()
    if not ref or ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlparse(ref)
    if parsed.scheme or parsed.netloc:
        return None
    path = parsed.path
    if not path:
        return None

    if path.startswith("/"):
        if BASE_PATH != "/" and not path.startswith(BASE_PATH):
            return None
        relative = path[len(BASE_PATH):] if BASE_PATH != "/" else path.lstrip("/")
        target = ROOT / relative
    else:
        target = page.parent / path

    if path.endswith("/"):
        target = target / "index.html"
    return target


def check_local_references() -> None:
    for name in ROOT_HTML:
        page = ROOT / name
        if not page.exists():
            base.error(f"Launch gate: missing HTML surface {name}")
            continue
        html = page.read_text(encoding="utf-8", errors="replace")
        for ref in LOCAL_REF_RE.findall(html):
            target = local_target(page, ref)
            if target is None:
                continue
            if not target.exists():
                base.error(f"{name}: broken local reference {ref}")

    bootstrap = base.text("assets/supabase-config.js")
    for raw in DYNAMIC_ASSET_RE.findall(bootstrap):
        rel = raw.split("?", 1)[0]
        if not (ROOT / rel).exists():
            base.error(f"supabase-config.js dynamically loads missing asset: {raw}")


def check_private_surface_isolation() -> None:
    robots = base.text("robots.txt")
    for page in PRIVATE_PAGES:
        html = base.text(page)
        if "noindex" not in html or "nofollow" not in html:
            base.error(f"{page}: private surface must stay noindex,nofollow.")
        directive = f"Disallow: {public_path(page)}"
        if directive not in robots:
            base.error(f"robots.txt missing private-surface directive: {directive}")

    newsroom = base.text("newsroom.html")
    if "assets/supabase-client-config.js" not in newsroom:
        base.error("newsroom.html must use the minimal private Supabase client config.")
    for forbidden in ("assets/supabase-config.js", "assets/analytics.js", "assets/monetization.js", "assets/story-router.js"):
        if forbidden in newsroom:
            base.error(f"newsroom.html unexpectedly boots public runtime asset: {forbidden}")

    private_config = base.text("assets/supabase-client-config.js").lower()
    for secret_marker in ("service_role", "secret_key", "sb_secret_"):
        if secret_marker in private_config:
            base.error(f"Private browser config contains forbidden secret marker: {secret_marker}")
    if "publishablekey" not in private_config:
        base.error("Minimal private Supabase config is missing a publishable key.")


def check_accessibility_and_performance() -> None:
    accessibility = base.text("assets/public-accessibility.js")
    performance = base.text("assets/performance.js")
    for marker in ("nc-skip-link", "focus-visible", "aria-modal", "Search Neural Critic", "Escape"):
        if marker not in accessibility:
            base.error(f"Accessibility runtime missing launch marker: {marker}")
    for marker in ("web_vital", "LCP", "CLS", "INP", "NeuralCriticAnalytics", "fetchpriority"):
        if marker not in performance:
            base.error(f"Performance runtime missing launch marker: {marker}")
    for page in ("index.html", "article.html", "category.html"):
        html = base.text(page)
        for asset in ("assets/performance.js", "assets/public-accessibility.js"):
            if asset not in html:
                base.error(f"{page} is missing launch-hardening asset: {asset}")


def check_reading_map_ownership() -> None:
    article = base.text("article.html")
    runtime = base.text("assets/article-runtime-integrity.js")
    presentation = base.text("assets/article-sidebar-interactive.js")
    story_router = base.text("assets/story-router.js")
    state_guard = base.text("assets/article-reading-map-guard.css")

    runtime_asset = "assets/article-runtime-integrity.js"
    bootstrap_asset = "assets/supabase-config.js"
    presentation_asset = "assets/article-sidebar-interactive.js"
    runtime_index = article.find(runtime_asset)
    bootstrap_index = article.find(bootstrap_asset)
    presentation_index = article.find(presentation_asset)
    if runtime_index < 0:
        base.error("article.html is missing the authoritative Reading Map controller.")
    if bootstrap_index < 0:
        base.error("article.html is missing the public bootstrap.")
    if presentation_index < 0:
        base.error("article.html is missing the Reading Map presentation layer.")
    if runtime_index >= 0 and bootstrap_index >= 0 and runtime_index > bootstrap_index:
        base.error("Reading Map controller must load before the public bootstrap stack.")
    if runtime_index >= 0 and presentation_index >= 0 and runtime_index > presentation_index:
        base.error("Reading Map controller must load before the sidebar presentation layer.")
    if "assets/article-reading-map-guard.css" not in article:
        base.error("article.html is missing the resilient Reading Map state guard.")

    runtime_markers = (
        "reading-map-v4-single-owner",
        "document.addEventListener('click', authoritativeClick, { capture:true })",
        "ownsInteraction: true",
        "scrollIntoView",
        "history.replaceState",
        "activeSectionForViewport",
        "aria-current",
        "function liveNav()",
        "observer.observe(host",
        "window.addEventListener('pageshow'",
    )
    for marker in runtime_markers:
        if marker not in runtime:
            base.error(f"Authoritative Reading Map runtime missing ownership marker: {marker}")

    for forbidden in ("event.defaultPrevented", "window.scrollTo({ top"):
        if forbidden in runtime:
            base.error(f"Reading Map runtime restored fragile interaction behavior: {forbidden}")

    for forbidden in ("installLegacyFallback", "addEventListener('click'", "window.scrollTo", "history.replaceState"):
        if forbidden in presentation:
            base.error(f"Reading Map presentation layer regained navigation authority: {forbidden}")

    for forbidden in ("bindReadingMap", ".work-toc", "HashChangeEvent('hashchange'"):
        if forbidden in story_router:
            base.error(f"Story router regained Reading Map authority: {forbidden}")

    for marker in ('scroll-margin-top', 'aria-current="location"', '.work-toc nav a.active'):
        if marker not in state_guard:
            base.error(f"Reading Map visual/navigation guard missing resilience marker: {marker}")

def check_account_creation_hardening() -> None:
    guard = base.text("assets/signup-hardening.js")
    bootstrap = base.text("assets/analytics-config.js")
    for marker in ("MIN_NEW_PASSWORD = 8", "#studio-signup", ".reader-auth-form", "new-password", "current-password"):
        if marker not in guard:
            base.error(f"Signup hardening runtime missing marker: {marker}")
    if "assets/signup-hardening.js" not in bootstrap:
        base.error("Shared public bootstrap is not loading signup-hardening.js.")


def check_monetization_locks() -> None:
    config = base.text("assets/monetization-config.js")
    runtime = base.text("assets/monetization.js")
    expected_config = (
        r"adsEnabled:\s*false",
        r"adProviderReady:\s*false",
        r"adProvider:\s*['\"]none['\"]",
        r"publisherId:\s*['\"]['\"]",
        r"requireConsentPlatform:\s*true",
        r"adsTxtRequired:\s*true",
    )
    for pattern in expected_config:
        if not re.search(pattern, config):
            base.error(f"Monetization launch lock missing: {pattern}")
    for marker in (
        "canServeAds",
        "NeuralCriticAdConsent",
        "affiliate_click",
        "commercial_disclosure_rendered",
        "ad_slot_viewable",
        "rel.add('sponsored')",
        "newsroom.html",
    ):
        if marker not in runtime:
            base.error(f"Monetization runtime missing safety marker: {marker}")


def check_canonical_author_identity() -> None:
    stories = ROOT / "stories"
    if not stories.exists():
        base.error("Launch gate: generated stories directory is missing.")
        return
    checked = 0
    author_prefix = public_path("authors/")
    for page in stories.glob("*/index.html"):
        html = page.read_text(encoding="utf-8", errors="replace")
        match = STRUCTURED_DATA_RE.search(html)
        if not match:
            continue
        try:
            schema = json.loads(match.group(1))
        except json.JSONDecodeError:
            base.error(f"{page.relative_to(ROOT)}: invalid article JSON-LD.")
            continue
        author = schema.get("author") if isinstance(schema, dict) else None
        if isinstance(author, dict) and author.get("@type") == "Person":
            checked += 1
            url = str(author.get("url") or "")
            path = urlparse(url).path
            if not path.startswith(author_prefix):
                base.error(f"{page.relative_to(ROOT)}: Person author is missing canonical writer URL.")
    if checked == 0:
        base.error("Launch gate could not verify any canonical Person author links.")


def check_release_workflow_coverage() -> None:
    workflow = base.text(".github/workflows/publication-health.yml")
    direct_paths = (
        "newsroom.html",
        "scripts/enrich_story_metadata.py",
        "scripts/build_robots.py",
        "scripts/publication_config.py",
        "scripts/audit_launch.py",
        "supabase/migrations/**",
    )
    for marker in direct_paths:
        if marker not in workflow:
            base.error(f"Publication health workflow does not watch release-sensitive path: {marker}")
    if "assets/**" not in workflow:
        base.error("Publication health workflow must watch the complete assets/** surface.")
    if "stories/**" not in workflow:
        base.error("Publication health workflow must watch generated story shells.")
    if "python scripts/audit_publication_v2.py" not in workflow:
        base.error("Publication health workflow no longer runs the publication audit.")
    if "python scripts/audit_launch.py" not in workflow:
        base.error("Publication health workflow is not running the final launch gate.")


def main() -> int:
    base.ERRORS.clear()
    base.WARNINGS.clear()
    check_local_references()
    check_private_surface_isolation()
    check_accessibility_and_performance()
    check_reading_map_ownership()
    check_account_creation_hardening()
    check_monetization_locks()
    check_canonical_author_identity()
    check_release_workflow_coverage()

    for message in base.WARNINGS:
        print(f"WARNING: {message}")
    if base.ERRORS:
        for message in base.ERRORS:
            print(f"ERROR: {message}", file=sys.stderr)
        print(f"Neural Critic launch gate failed with {len(base.ERRORS)} error(s).", file=sys.stderr)
        return 1
    print("Neural Critic launch gate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())