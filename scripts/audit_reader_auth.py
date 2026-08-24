#!/usr/bin/env python3
"""Release checks for Neural Critic Reader Auth V2."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    target = ROOT / path
    if not target.exists():
        raise RuntimeError(f"Missing Reader Auth V2 file: {path}")
    return target.read_text(encoding="utf-8", errors="replace")


def main() -> int:
    errors: list[str] = []
    bootstrap = text("assets/analytics-config.js")
    runtime = text("assets/reader-auth-v2.js")
    style = text("assets/reader-auth-v2.css")
    signup_guard = text("assets/signup-hardening.js")

    for marker in (
        "assets/reader-auth-v2.js",
        "data-nc-reader-auth-v2",
        "studio.html",
        "subscribers.html",
        "newsroom.html",
    ):
        if marker not in bootstrap:
            errors.append(f"Reader Auth V2 bootstrap missing marker: {marker}")

    runtime_markers = (
        "MIN_PASSWORD = 8",
        "ROOT_REDIRECT = `${location.origin}/`",
        "/auth/v1/settings",
        "headers: { apikey: cfg.publishableKey }",
        "['google','apple','x','discord']",
        "external.x === true",
        "signInWithOAuth",
        "resetPasswordForEmail",
        "PASSWORD_RECOVERY",
        "updateUser({ password })",
        "emailRedirectTo: ROOT_REDIRECT",
        "redirectTo: ROOT_REDIRECT",
        "stopImmediatePropagation",
        "window.neuralCriticReaderSupabase",
        "window.neuralCriticCommunitySupabase",
        "reader-auth-password-toggle",
        "reader-auth-reset-request",
        "reader-auth-password-update",
    )
    for marker in runtime_markers:
        if marker not in runtime:
            errors.append(f"Reader Auth V2 runtime missing marker: {marker}")

    if "provider: 'twitter'" in runtime or 'provider: "twitter"' in runtime:
        errors.append("Reader Auth V2 must use X OAuth 2.0 provider `x`, not legacy Twitter OAuth.")
    if "emailRedirectTo:location.href" in runtime.replace(" ", ""):
        errors.append("Reader Auth V2 still uses page-specific signup redirects instead of the production root.")

    style_markers = (
        ".reader-auth-social",
        ".reader-auth-provider",
        ".reader-auth-forgot",
        ".reader-auth-subview",
        ".reader-auth-password-toggle",
        'html[data-theme="light"] .reader-auth-card',
        "@media(max-width:560px)",
        "prefers-reduced-motion",
    )
    for marker in style_markers:
        if marker not in style:
            errors.append(f"Reader Auth V2 presentation missing marker: {marker}")

    for marker in ("MIN_NEW_PASSWORD = 8", ".reader-auth-form", "new-password", "current-password"):
        if marker not in signup_guard:
            errors.append(f"Shared signup password guard missing marker: {marker}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Reader Auth V2 audit failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print("Neural Critic Reader Auth V2 audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
