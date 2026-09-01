#!/usr/bin/env python3
"""Fail if the Weekly Drop delivery bridge loses its provider/admin safeguards."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ACTIONS = ROOT / "supabase" / "functions" / "public-actions" / "index.ts"
NEWSLETTER_ADMIN = ROOT / "supabase" / "functions" / "newsletter-admin" / "index.ts"
SUPABASE_CONFIG = ROOT / "supabase" / "config.toml"
SUBSCRIBERS_HTML = ROOT / "subscribers.html"
SUBSCRIBERS_JS = ROOT / "assets" / "subscribers.js"
DOC = ROOT / "NEWSLETTER_DELIVERY.md"


def fail(message: str) -> None:
    raise SystemExit(f"NEWSLETTER DELIVERY FAILED: {message}")


def text(path: Path) -> str:
    if not path.exists():
        fail(f"missing required file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(haystack: str, marker: str, message: str) -> None:
    if marker not in haystack:
        fail(message)


def main() -> int:
    public_actions = text(PUBLIC_ACTIONS)
    newsletter_admin = text(NEWSLETTER_ADMIN)
    supabase_config = text(SUPABASE_CONFIG)
    subscribers_html = text(SUBSCRIBERS_HTML)
    subscribers_js = text(SUBSCRIBERS_JS)
    doc = text(DOC)

    require(public_actions, 'Deno.env.get("RESEND_API_KEY")', "public signup bridge lost server-only Resend configuration")
    require(public_actions, 'Deno.env.get("RESEND_NEWSLETTER_SEGMENT_ID")', "public signup bridge lost the dedicated Weekly Drop segment")
    require(public_actions, "syncResendSubscriber", "public re-subscription no longer repairs provider membership")
    require(public_actions, 'action === "subscribe"', "tracked public-actions source no longer contains newsletter signup")
    if "RESEND_API_KEY" in public_actions and "window." in public_actions:
        fail("provider secret appears to be mixed with browser code")

    require(newsletter_admin, 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', "newsletter admin function lost server-side Supabase access")
    require(newsletter_admin, 'Deno.env.get("RESEND_API_KEY")', "newsletter admin function lost provider configuration")
    require(newsletter_admin, '/auth/v1/user', "newsletter admin function no longer validates the requesting Supabase user")
    require(newsletter_admin, 'role !== "admin"', "newsletter admin function no longer enforces admin role")
    require(newsletter_admin, '"https://neuralcritic.net"', "newsletter admin lost the production origin allowlist")
    require(newsletter_admin, '"https://www.neuralcritic.net"', "newsletter admin lost the www origin allowlist")
    require(newsletter_admin, 'req.method === "OPTIONS"', "newsletter admin no longer accepts browser CORS preflight")
    require(newsletter_admin, '"Access-Control-Allow-Headers": "authorization, content-type, apikey"', "newsletter admin CORS no longer permits authenticated Subscriber Desk headers")
    require(newsletter_admin, 'action === "status"', "provider readiness action is missing")
    require(newsletter_admin, 'action === "sync"', "provider reconciliation action is missing")
    require(newsletter_admin, 'action === "set_status"', "admin status propagation action is missing")
    require(newsletter_admin, "provider_only_removed", "sync no longer prevents provider-only recipients from staying in the Weekly Drop segment")
    require(newsletter_admin, "provider_unsubscribes_applied", "provider unsubscribe reconciliation is missing")

    require(supabase_config, "[functions.public-actions]", "Supabase function config no longer declares public-actions")
    require(supabase_config, "[functions.newsletter-admin]", "Supabase function config no longer declares newsletter-admin")
    newsletter_admin_config = supabase_config.split("[functions.newsletter-admin]", 1)[1]
    if "verify_jwt = false" not in newsletter_admin_config.split("[functions.", 1)[0]:
        fail("newsletter-admin must disable the legacy gateway JWT check because authorization is enforced inside the function")

    require(subscribers_html, 'id="delivery-status"', "Subscriber Desk no longer exposes provider readiness")
    require(subscribers_html, 'id="sync-delivery"', "Subscriber Desk no longer exposes delivery synchronization")
    require(subscribers_js, '/functions/v1/newsletter-admin', "Subscriber Desk no longer uses the protected newsletter admin function")
    require(subscribers_js, "Bearer ${currentSession.access_token}", "Subscriber Desk no longer sends its authenticated admin token")
    require(subscribers_js, "newsletterAdmin('sync')", "Subscriber Desk no longer synchronizes the delivery list")
    require(subscribers_js, "newsletterAdmin('set_status'", "subscriber status changes no longer propagate through the protected provider bridge")

    require(doc, "updates.neuralcritic.net", "delivery activation guide lost the dedicated sending-subdomain recommendation")
    require(doc, "unsubscribed", "delivery guide no longer documents unsubscribe handling")
    require(doc, "outbound sending remains disabled", "delivery guide no longer states the provider activation boundary")
    require(doc, "Full access", "delivery guide no longer documents the provider permission required for Contacts and Segments")

    print("Newsletter delivery audit passed: provider sync, admin auth/CORS, Edge auth config, and unsubscribe safeguards are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
