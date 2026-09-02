#!/usr/bin/env python3
"""Focused, deterministic contracts for the Neural Critic overhaul baseline.

This audit complements the domain-specific audits. It protects the cross-system
assumptions that future overhaul milestones are most likely to break: public
entry points, local references, canonical story/runtime parity, article assets,
format structure, duplicate module loading, public/private boundaries, and
client-side secret hygiene.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://www.neuralcritic.net"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

REQUIRED_ENTRY_POINTS = (
    "index.html",
    "article.html",
    "category.html",
    "search.html",
    "games/index.html",
    "game.html",
    "topic.html",
    "reviews/index.html",
    "deals.html",
    "studio.html",
    "newsroom.html",
    "subscribers.html",
)
PRIVATE_PAGES = ("studio.html", "newsroom.html", "subscribers.html")
ALLOWED_FORMATS = {"standard", "ranked-list", "game-guide", "review"}
REQUIRED_ARTICLE_MODULES = (
    "assets/article-runtime-integrity.js",
    "assets/content-api.js",
    "assets/local-assets.js",
    "assets/app.js",
    "assets/article-extras.js",
)
CLIENT_SECRET_PATTERNS = {
    "Supabase service-role environment name": re.compile(r"SUPABASE_SERVICE_ROLE_KEY", re.I),
    "Supabase secret key": re.compile(r"sb_secret_[A-Za-z0-9_-]+"),
    "Resend API key": re.compile(r"RESEND_API_KEY|re_[A-Za-z0-9_-]{20,}"),
    "database URL": re.compile(r"(?:DATABASE_URL|POSTGRES_PASSWORD)\s*[:=]", re.I),
}
CAPABILITY_FIELDS = (
    "capability_id", "domain", "capability", "benchmark_behavior",
    "neural_critic_equivalent", "status", "verification_level", "entry_points",
    "owner_files", "data_source", "journey", "evidence", "known_limitations",
    "dependencies", "regression_risk", "last_verified", "milestone", "notes",
)


class Audit:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.metrics: Counter[str] = Counter()

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def warn(self, condition: bool, message: str) -> None:
        if not condition:
            self.warnings.append(message)


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base_href = ""
        self.references: list[tuple[str, str, str]] = []
        self.scripts: list[str] = []
        self.styles: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag == "base" and values.get("href"):
            self.base_href = values["href"]
            return

        for attribute in ("src", "href", "poster"):
            value = values.get(attribute, "").strip()
            if not value:
                continue
            if tag == "a" and attribute != "href":
                continue
            if tag == "link" and attribute != "href":
                continue
            if tag == "script" and attribute != "src":
                continue
            if tag in {"img", "source"} and attribute != "src":
                continue
            if tag == "video" and attribute not in {"src", "poster"}:
                continue
            if tag not in {"a", "link", "script", "img", "source", "video"}:
                continue
            self.references.append((tag, attribute, value))

        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if tag == "link" and "stylesheet" in values.get("rel", "").lower() and values.get("href"):
            self.styles.append(values["href"])


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_html(path: Path) -> ReferenceParser:
    parser = ReferenceParser()
    parser.feed(read_text(path))
    return parser


def normalized_local_path(value: str) -> str | None:
    if value.startswith("//"):
        return None
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc or value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    return unquote(parsed.path).replace("\\", "/") or None


def resolve_reference(page: Path, base_href: str, value: str) -> Path | None:
    relative = normalized_local_path(value)
    if not relative:
        return None
    if relative.startswith("/") or base_href.startswith("/"):
        candidate = ROOT / relative.lstrip("/")
    else:
        candidate = page.parent / relative
    candidate = candidate.resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        return candidate
    if candidate.is_dir() or relative.endswith("/"):
        candidate /= "index.html"
    return candidate


def asset_key(value: str) -> str | None:
    path = normalized_local_path(value)
    if not path:
        return None
    return path.lstrip("/")


def audit_entry_points(audit: Audit) -> None:
    for relative in REQUIRED_ENTRY_POINTS:
        audit.require((ROOT / relative).is_file(), f"Missing required entry point: {relative}")
    audit.metrics["entry points"] = len(REQUIRED_ENTRY_POINTS)


def audit_html_references(audit: Audit) -> None:
    html_files = sorted(path for path in ROOT.rglob("*.html") if ".git" not in path.parts)
    reference_count = 0
    for path in html_files:
        parser = parse_html(path)
        for tag, attribute, value in parser.references:
            target = resolve_reference(path, parser.base_href, value)
            if target is None:
                continue
            reference_count += 1
            audit.require(
                target.is_file(),
                f"Broken internal {tag}[{attribute}] in {path.relative_to(ROOT)}: {value} -> {target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}",
            )

        duplicate_scripts = [key for key, count in Counter(filter(None, map(asset_key, parser.scripts))).items() if count > 1]
        duplicate_styles = [key for key, count in Counter(filter(None, map(asset_key, parser.styles))).items() if count > 1]
        audit.require(not duplicate_scripts, f"Duplicate static scripts in {path.relative_to(ROOT)}: {', '.join(duplicate_scripts)}")
        audit.require(not duplicate_styles, f"Duplicate static stylesheets in {path.relative_to(ROOT)}: {', '.join(duplicate_styles)}")

    audit.metrics["HTML documents"] = len(html_files)
    audit.metrics["internal references"] = reference_count


def audit_canonical_stories(audit: Audit) -> list[dict]:
    index_path = ROOT / "data/articles.json"
    audit.require(index_path.is_file(), "Missing data/articles.json runtime fallback")
    if not index_path.is_file():
        return []

    rows = json.loads(read_text(index_path))
    audit.require(isinstance(rows, list) and bool(rows), "data/articles.json must contain published article rows")
    if not isinstance(rows, list):
        return []

    sitemap_root = ET.parse(ROOT / "sitemap.xml").getroot()
    sitemap_urls = {element.text for element in sitemap_root.iter() if element.tag.endswith("loc") and element.text}
    seen: set[str] = set()
    for row in rows:
        slug = str(row.get("slug") or "").strip()
        audit.require(bool(SLUG_RE.fullmatch(slug)), f"Invalid published article slug: {slug!r}")
        audit.require(slug not in seen, f"Duplicate published article slug: {slug}")
        seen.add(slug)
        if not slug:
            continue

        detail_path = ROOT / "data" / "articles" / f"{slug}.json"
        story_path = ROOT / "stories" / slug / "index.html"
        canonical = f"{SITE_ORIGIN}/stories/{slug}/"
        audit.require(detail_path.is_file(), f"Missing article detail fallback: data/articles/{slug}.json")
        audit.require(story_path.is_file(), f"Missing canonical story shell: stories/{slug}/index.html")
        audit.require(canonical in sitemap_urls, f"Canonical story missing from sitemap.xml: {canonical}")

        if detail_path.is_file():
            detail = json.loads(read_text(detail_path))
            audit.require(detail == row, f"Runtime index/detail data diverge for {slug}")
        if story_path.is_file():
            story = read_text(story_path)
            audit.require(f'rel="canonical" href="{canonical}"' in story, f"Canonical link changed or missing for {slug}")
            audit.require(f'window.NEURAL_CRITIC_STATIC_SLUG="{slug}"' in story, f"Static runtime slug marker missing for {slug}")
            audit.require("generated: neural-critic-story-shell" in story, f"Generated story marker missing for {slug}")
            for module in REQUIRED_ARTICLE_MODULES:
                audit.require(module in story, f"Canonical story {slug} is missing runtime module {module}")

    audit.metrics["canonical stories"] = len(rows)
    return rows


def validate_local_image(audit: Audit, value: object, context: str) -> None:
    if not isinstance(value, str) or not value.strip():
        return
    path = normalized_local_path(value)
    if path:
        audit.require((ROOT / path.lstrip("/")).is_file(), f"Missing local article image for {context}: {value}")


def audit_article_contracts(audit: Audit, rows: list[dict]) -> None:
    formats: Counter[str] = Counter()
    for row in rows:
        slug = str(row.get("slug") or "<unknown>")
        article_format = str(row.get("articleFormat") or "standard")
        formats[article_format] += 1
        audit.require(article_format in ALLOWED_FORMATS, f"Unsupported article format for {slug}: {article_format}")

        for field in ("title", "description", "author", "category", "publishedAt", "imageLocal", "imageAlt"):
            audit.require(bool(str(row.get(field) or "").strip()), f"Article {slug} is missing required {field}")
        audit.require(
            bool(str(row.get("body") or "").strip()) or bool(row.get("contentBlocks")),
            f"Article {slug} has neither an introduction nor content blocks",
        )
        validate_local_image(audit, row.get("imageLocal"), f"{slug} hero")
        for index, block in enumerate(row.get("contentBlocks") or []):
            if isinstance(block, dict):
                validate_local_image(audit, block.get("imageLocal"), f"{slug} block {index + 1}")

        if article_format == "ranked-list":
            ranked = [block for block in row.get("contentBlocks") or [] if str(block.get("rank") or "").isdigit()]
            audit.require(bool(ranked), f"Ranked list {slug} has no ranked content blocks")
        elif article_format == "game-guide":
            steps = [block for block in row.get("contentBlocks") or [] if block.get("heading") and block.get("text")]
            audit.require(bool(steps), f"Game guide {slug} has no structured heading/text steps")
        elif article_format == "review":
            meta = row.get("reviewMeta") or {}
            for field in ("score", "verdict", "pros", "cons"):
                audit.require(bool(meta.get(field)), f"Review {slug} is missing reviewMeta.{field}")
            audit.warn(bool(meta.get("testedPlatform")), f"Review {slug} does not record a tested platform")

    missing_formats = ALLOWED_FORMATS - set(formats)
    audit.require(not missing_formats, f"Published fallback lost article formats: {', '.join(sorted(missing_formats))}")
    audit.metrics.update({f"format {name}": count for name, count in sorted(formats.items())})


def audit_duplicate_loader_guards(audit: Audit) -> None:
    local_assets = read_text(ROOT / "assets/local-assets.js")
    supabase_config = read_text(ROOT / "assets/supabase-config.js")
    audit.require("publicationNavLoaded" in local_assets, "Publication navigation loader lacks a source-aware duplicate guard")
    audit.require("/assets/publication-nav.js" in local_assets, "Publication navigation loader does not guard its canonical script path")
    audit.require("DOMContentLoaded', ensurePublicationNav" in local_assets, "Publication navigation guard runs before later static tags can be discovered")
    audit.require(supabase_config.count("afterDocumentParsed(() => {") >= 3, "Overlapping dynamic loaders must wait until static markup is parsed")
    for tag, file_name in (
        ("script", "newsletter.js"),
        ("script", "article-news.js"),
        ("link", "article-news.css"),
        ("script", "studio-news.js"),
        ("link", "studio-news.css"),
    ):
        audit.require(
            f"hasAsset('{tag}', '{file_name}')" in supabase_config,
            f"Dynamic loader lacks a path-aware duplicate guard for assets/{file_name}",
        )


def audit_boundaries(audit: Audit) -> None:
    robots = read_text(ROOT / "robots.txt")
    for relative in PRIVATE_PAGES:
        source = read_text(ROOT / relative).lower()
        audit.require("noindex" in source and "nofollow" in source, f"Private surface {relative} must remain noindex,nofollow")
        audit.require(f"Disallow: /{relative}" in robots, f"robots.txt no longer disallows {relative}")

    public_html = [
        path for path in ROOT.rglob("*.html")
        if ".git" not in path.parts and path.name not in PRIVATE_PAGES and path.relative_to(ROOT).as_posix() not in PRIVATE_PAGES
    ]
    for path in public_html:
        audit.require(
            "assets/supabase-client-config.js" not in read_text(path),
            f"Public page loads private Supabase client bootstrap: {path.relative_to(ROOT)}",
        )
    audit.metrics["private surfaces"] = len(PRIVATE_PAGES)


def audit_client_secret_hygiene(audit: Audit) -> None:
    client_files = sorted(path for path in ROOT.rglob("*.html") if ".git" not in path.parts)
    client_files += sorted((ROOT / "assets").glob("*.js"))
    client_files += sorted((ROOT / "data").rglob("*.json"))
    for path in client_files:
        source = read_text(path)
        for label, pattern in CLIENT_SECRET_PATTERNS.items():
            audit.require(not pattern.search(source), f"Possible {label} exposed in client-facing file {path.relative_to(ROOT)}")
    audit.metrics["client files secret-scanned"] = len(client_files)


def audit_ci_wiring(audit: Audit) -> None:
    workflow = read_text(ROOT / ".github/workflows/publication-health.yml")
    milestone_3_report = ROOT / "docs/MILESTONE_3_REPORT.md"
    audit.require(milestone_3_report.is_file(), "Missing Milestone 3 evidence report")
    audit.require("docs/MILESTONE_3_REPORT.md" in workflow, "Publication health workflow does not watch the Milestone 3 evidence report")
    audit.require("scripts/audit_overhaul_baseline.py" in workflow, "Publication health workflow does not watch the overhaul baseline audit")
    audit.require("python scripts/audit_overhaul_baseline.py" in workflow, "Publication health workflow does not run the overhaul baseline audit")
    audit.require("scripts/test_protected_runtime.js" in workflow, "Publication health workflow does not watch the protected runtime regression suite")
    audit.require("node scripts/test_protected_runtime.js" in workflow, "Publication health workflow does not run the protected runtime regression suite")
    audit.require("scripts/audit_live_auth_boundaries.py" in workflow, "Publication health workflow does not watch the live auth-boundary audit")
    audit.require("python scripts/audit_live_auth_boundaries.py" in workflow, "Publication health workflow does not run the live auth-boundary audit")


def audit_capability_model(audit: Audit) -> None:
    model_path = ROOT / "docs/CAPABILITY_STATUS.md"
    ledger_path = ROOT / "docs/CAPABILITY_STATUS.csv"
    audit.require(model_path.is_file(), "Missing capability status model documentation")
    audit.require(ledger_path.is_file(), "Missing capability status CSV ledger")
    if not ledger_path.is_file():
        return

    with ledger_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        audit.require(tuple(reader.fieldnames or ()) == CAPABILITY_FIELDS, "Capability ledger columns changed without updating the baseline contract")
        rows = list(reader)

    seen: set[str] = set()
    for index, row in enumerate(rows, start=1):
        capability_id = str(row.get("capability_id") or "")
        match = re.fullmatch(r"NC-GS-(\d{3})", capability_id)
        audit.require(bool(match) and 1 <= int(match.group(1)) <= 200, f"Invalid capability ID: {capability_id!r}")
        audit.require(capability_id == f"NC-GS-{index:03d}", f"Out-of-sequence capability ID: {capability_id!r}")
        audit.require(capability_id not in seen, f"Duplicate capability ID: {capability_id}")
        seen.add(capability_id)
        audit.require(str(row.get("status") or "") in {"✅", "🟡", "❌", "🚫"}, f"Invalid capability status for {capability_id}")
        audit.require(str(row.get("verification_level") or "") in {"V0", "V1", "V2", "V3", "V4", "V5"}, f"Invalid verification level for {capability_id}")
        for field in CAPABILITY_FIELDS:
            audit.require(bool(str(row.get(field) or "").strip()), f"Empty capability field {field} for {capability_id}")

    audit.require(len(rows) == 200, "Capability ledger must contain the complete 200-capability benchmark")
    audit.metrics["capability rows"] = len(rows)


def main() -> int:
    audit = Audit()
    audit_entry_points(audit)
    audit_html_references(audit)
    rows = audit_canonical_stories(audit)
    audit_article_contracts(audit, rows)
    audit_duplicate_loader_guards(audit)
    audit_boundaries(audit)
    audit_client_secret_hygiene(audit)
    audit_ci_wiring(audit)
    audit_capability_model(audit)

    for warning in audit.warnings:
        print(f"WARNING: {warning}")
    for error in audit.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    summary = ", ".join(f"{name}={count}" for name, count in sorted(audit.metrics.items()))
    print(f"Overhaul baseline audit: {len(audit.errors)} error(s), {len(audit.warnings)} warning(s); {summary}")
    return 1 if audit.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
