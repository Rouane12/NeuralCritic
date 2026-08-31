#!/usr/bin/env python3
"""Release checks for Neural Critic Reader Auth V2 and Saved Stories."""

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
    saved = text("assets/saved-stories.js")
    saved_migration = text("supabase/migrations/20260831204500_reader_saved_stories_v1.sql")

    for marker in (
        "assets/reader-auth-v2.js",
        "data-nc-reader-auth-v2",
        "studio.html",
        "subscribers.html",
        "newsroom.html",
        "assets/saved-stories.js?v=20260831-saved5",
        "data-nc-saved-stories",
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

    for marker in (
        "reader_saved_stories",
        "nc-save-story",
        "nc-saved-account",
        "NeuralCriticSavedStories",
        "nc:saved-stories-changed",
        ".work-react-rail",
        "data-article-share",
        "bookmarkIcon",
        "savedWithContext",
        "insert({ user_id:user.id, article_slug:articleSlug })",
        "Saved Stories insert could not be verified.",
        "Saved Stories removal could not be verified.",
        "accountModalIsOpen",
        "accountExtensionHost",
        "reader-account-extensions",
        "dataset.readerAccountExtensions",
        "readerAccountExtension = 'saved-stories'",
        "refreshAccountSoon",
        "visibilitychange",
        "relativeSavedAt",
        "SYNCED NOW",
        "/data/articles.json",
        "/stories/${encodeURIComponent(row.article_slug)}/",
    ):
        if marker not in saved:
            errors.append(f"Saved Stories runtime missing marker: {marker}")

    if "nc-save-story-wrap" in saved:
        errors.append("Saved Stories must live in the existing article reaction rail, not a standalone article-header control.")
    if "const slot = $('.reader-profile-slot')" in saved:
        errors.append("Saved Stories account content must not mount inside the mutable reader profile slot.")

    for marker in (
        "create table if not exists public.reader_saved_stories",
        "primary key (user_id, article_slug)",
        "enable row level security",
        "grant select, insert, delete",
        "auth.uid()) = user_id",
    ):
        if marker not in saved_migration:
            errors.append(f"Saved Stories migration missing marker: {marker}")

    if "grant" in saved_migration.lower() and " to anon" in saved_migration.lower() and "revoke all" not in saved_migration.lower():
        errors.append("Saved Stories must not grant table access to anon readers.")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Reader Auth V2 audit failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print("Neural Critic Reader Auth V2 + Saved Stories audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
