#!/usr/bin/env python3
"""Verify Neural Critic publication and runtime surfaces can switch origins safely."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = (
    "build_robots.py",
    "build_sitemap.py",
    "build_story_pages.py",
    "build_topic_pages.py",
    "build_author_pages.py",
    "enrich_story_metadata.py",
)
PRODUCTION_ORIGIN = "https://www.neuralcritic.net/"
LEGACY_ORIGIN = "https://rouane12.github.io/NeuralCritic/"
LEGACY_BASE_LITERAL = '<base href="/NeuralCritic/">'


def probe(site_url: str | None) -> tuple[str, str, str]:
    env = os.environ.copy()
    if site_url is None:
        env.pop("NEURAL_CRITIC_SITE_URL", None)
    else:
        env["NEURAL_CRITIC_SITE_URL"] = site_url
    code = (
        "from publication_config import SITE_URL, BASE_PATH, public_path; "
        "print(SITE_URL); print(BASE_PATH); print(public_path('article.html'))"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=ROOT / "scripts",
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )
    values = result.stdout.strip().splitlines()
    if len(values) != 3:
        raise RuntimeError(f"Unexpected publication-config probe output: {values!r}")
    return values[0], values[1], values[2]


def probe_robots(site_url: str | None) -> str:
    env = os.environ.copy()
    if site_url is None:
        env.pop("NEURAL_CRITIC_SITE_URL", None)
    else:
        env["NEURAL_CRITIC_SITE_URL"] = site_url
    result = subprocess.run(
        [sys.executable, "-c", "from build_robots import render; print(render(), end='')"],
        cwd=ROOT / "scripts",
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def main() -> int:
    errors: list[str] = []

    default_url, default_base, default_article = probe(None)
    if default_url != PRODUCTION_ORIGIN:
        errors.append(f"Default production site URL is wrong: {default_url}")
    if default_base != "/":
        errors.append(f"Default production base path must be root: {default_base}")
    if default_article != "/article.html":
        errors.append(f"Default production runtime article path is wrong: {default_article}")

    default_robots = probe_robots(None)
    if "Disallow: /studio.html" not in default_robots:
        errors.append("Default production robots output lost the root private path")
    if "Sitemap: https://www.neuralcritic.net/sitemap.xml" not in default_robots:
        errors.append("Default production robots output has the wrong sitemap origin")
    if "/NeuralCritic/" in default_robots:
        errors.append("Default production robots output still contains the legacy project path")

    legacy_url, legacy_base, legacy_article = probe(LEGACY_ORIGIN)
    if legacy_url != LEGACY_ORIGIN:
        errors.append(f"Legacy rollback URL normalization failed: {legacy_url}")
    if legacy_base != "/NeuralCritic/":
        errors.append(f"Legacy rollback base path failed: {legacy_base}")
    if legacy_article != "/NeuralCritic/article.html":
        errors.append(f"Legacy rollback article path failed: {legacy_article}")

    legacy_robots = probe_robots(LEGACY_ORIGIN)
    if "Disallow: /NeuralCritic/studio.html" not in legacy_robots:
        errors.append("Legacy rollback robots output lost the project-path private prefix")
    if "Sitemap: https://rouane12.github.io/NeuralCritic/sitemap.xml" not in legacy_robots:
        errors.append("Legacy rollback robots output has the wrong sitemap origin")

    custom_url, custom_base, custom_article = probe("https://www.example.com")
    if custom_url != "https://www.example.com/":
        errors.append(f"Custom root-domain URL normalization failed: {custom_url}")
    if custom_base != "/":
        errors.append(f"Custom root-domain base path failed: {custom_base}")
    if custom_article != "/article.html":
        errors.append(f"Custom root-domain runtime path failed: {custom_article}")

    custom_robots = probe_robots("https://www.example.com")
    if "Disallow: /studio.html" not in custom_robots:
        errors.append("Root-domain robots output did not move private paths to the root")
    if "Sitemap: https://www.example.com/sitemap.xml" not in custom_robots:
        errors.append("Root-domain robots output has the wrong sitemap origin")
    if "/NeuralCritic/" in custom_robots:
        errors.append("Root-domain robots output still contains the legacy project path")

    nested_url, nested_base, nested_article = probe("https://example.com/publication")
    if nested_url != "https://example.com/publication/":
        errors.append(f"Nested deployment URL normalization failed: {nested_url}")
    if nested_base != "/publication/":
        errors.append(f"Nested deployment base path failed: {nested_base}")
    if nested_article != "/publication/article.html":
        errors.append(f"Nested deployment runtime path failed: {nested_article}")

    for filename in SCRIPTS:
        path = ROOT / "scripts" / filename
        text = path.read_text(encoding="utf-8")
        if "publication_config" not in text:
            errors.append(f"{filename} does not use centralized publication_config")
        if LEGACY_ORIGIN in text:
            errors.append(f"{filename} still hard-codes the legacy GitHub Pages origin")
        if LEGACY_BASE_LITERAL in text:
            errors.append(f"{filename} still hard-codes the legacy base path")

    router = (ROOT / "assets" / "story-router.js").read_text(encoding="utf-8")
    if "new URL('./', document.baseURI)" not in router:
        errors.append("story-router.js is not deriving the site root from document.baseURI")
    if "new URL('/NeuralCritic/'" in router:
        errors.append("story-router.js still hard-codes the legacy project root")

    recovery = (ROOT / "404.html").read_text(encoding="utf-8")
    if "NEURAL_CRITIC_404_ROOT" not in recovery or "location.pathname.startsWith('/NeuralCritic/')" not in recovery:
        errors.append("404 recovery is not compatible with both GitHub Pages and root-domain paths")

    home = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
    if LEGACY_ORIGIN in home:
        errors.append("index.html still exposes the legacy GitHub Pages origin in static metadata")
    if f'rel="canonical" href="{PRODUCTION_ORIGIN}"' not in home:
        errors.append("index.html static canonical does not point to the production domain")
    if f'property="og:url" content="{PRODUCTION_ORIGIN}"' not in home:
        errors.append("index.html static Open Graph URL does not point to the production domain")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Domain readiness audit failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print("Neural Critic domain readiness audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
