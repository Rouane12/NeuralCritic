#!/usr/bin/env python3
"""Static launch gate for Neural Critic Commerce & Price Intelligence."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"Commerce audit failed: {message}")


def text(path: str) -> str:
    target = ROOT / path
    require(target.exists(), f"missing {path}")
    return target.read_text(encoding="utf-8")


def audit_surface() -> None:
    deals = text("deals.html")
    require('name="robots" content="noindex,follow' in deals, "Deals page must stay noindex until a real feed is connected")
    require('assets/commerce.css' in deals and 'assets/commerce.js' in deals, "Deals page commerce assets are not wired")
    require('id="commerce-grid"' in deals, "Deals page is missing the live offer grid")
    require("No invented deals" in deals, "Deals page trust copy was removed")

    home = text("index.html")
    require('id="home-commerce" class="home-commerce" hidden' in home, "homepage commerce host must default to hidden")
    require('assets/home-commerce.js' in home and 'assets/home-commerce.css' in home, "homepage commerce module is not wired")

    article = text("article.html")
    require('assets/article-commerce.css' in article and 'assets/article-commerce.js' in article, "article Where to Buy module is not wired")


def audit_schema() -> None:
    migration_dir = ROOT / "supabase" / "migrations"
    commerce_files = sorted(migration_dir.glob("*commerce*.sql"))
    require(commerce_files, "commerce migrations are missing")
    sql = "\n".join(path.read_text(encoding="utf-8") for path in commerce_files).lower()

    for table in (
        "commerce_retailers",
        "commerce_products",
        "commerce_offers",
        "commerce_price_history",
        "commerce_article_products",
    ):
        require(f"public.{table}" in sql, f"schema does not reference {table}")
        require(f"alter table public.{table} enable row level security" in sql, f"RLS not enabled for {table}")

    require("capture_commerce_offer_history" in sql, "automatic price-history trigger is missing")
    require("for select to anon, authenticated" in sql, "public reads are not explicitly scoped")
    require("insert into public.commerce_products" not in sql, "commerce migrations must not seed fake products")
    require("insert into public.commerce_offers" not in sql, "commerce migrations must not seed fake offers")

    editor_migrations = sorted(migration_dir.glob("*update_game_storefront_metadata.sql"))
    require(editor_migrations, "game storefront editor permission migration is missing")
    editor_sql = "\n".join(path.read_text(encoding="utf-8") for path in editor_migrations).lower()
    require("grant update (metadata) on public.games to authenticated" in editor_sql, "Studio must receive metadata-only game update privilege")
    require('create policy "editors can update game metadata"' in editor_sql, "game metadata update policy is missing")
    require("editor_profiles" in editor_sql and "'editor'" in editor_sql and "'admin'" in editor_sql, "game metadata writes are not restricted to approved editors")


def audit_client_safety() -> None:
    commerce_js = text("assets/commerce.js")
    home_js = text("assets/home-commerce.js")
    article_js = text("assets/article-commerce.js")
    article_css = text("assets/article-commerce.css")
    studio_js = text("assets/studio.js")
    studio_backend = text("assets/studio-backend.js")
    studio_commerce = text("assets/studio-commerce-editor.js")
    studio_commerce_css = text("assets/studio-commerce.css")
    importer = text("scripts/import_commerce_feed.py")

    for name, source in (("commerce.js", commerce_js), ("home-commerce.js", home_js), ("article-commerce.js", article_js), ("studio-commerce-editor.js", studio_commerce)):
        require("SUPABASE_SERVICE_ROLE_KEY" not in source, f"{name} must never reference the service-role secret")

    require('rel=\\"sponsored noopener noreferrer\\"' in commerce_js or 'rel="sponsored noopener noreferrer"' in commerce_js, "Deals links are not sponsor-hardened")
    require("SUPABASE_SERVICE_ROLE_KEY" in importer, "server-side importer is not requiring the service-role secret")
    require("--dry-run" in importer, "commerce importer must keep a no-write validation mode")

    for table in ("commerce_article_products", "commerce_products", "commerce_offers", "commerce_retailers"):
        require(table in article_js, f"article live-offer path no longer references {table}")

    require("renderReviewStorefrontFallback" in article_js, "review storefront fallback is missing")
    require("metadata?.storefronts" in article_js, "review storefront fallback is not backed by canonical game metadata")
    require("article_format" in article_js and "game_key" in article_js, "review storefront fallback is not scoped to review/game identity")
    require("commercial_meta" in article_js and "where_to_buy_enabled === false" in article_js, "article commerce runtime does not honor the editorial Where to Buy opt-out")
    require(".work-article-sidebar" in article_js and "review-where-to-buy" in article_js, "review storefront module is not integrated with the article sidebar")
    require("commerce_storefront_rendered" in article_js and "commerce_storefront_click" in article_js, "review storefront analytics are incomplete")

    start = article_js.find("async function renderReviewStorefrontFallback")
    end = article_js.find("async function init()", start)
    require(start >= 0 and end > start, "could not isolate review storefront fallback for safety audit")
    fallback = article_js[start:end]
    require('rel="noopener noreferrer"' in fallback, "non-affiliate storefront links are not hardened")
    require("currently receives no commission" in fallback, "non-affiliate disclosure is missing")
    require("sponsored" not in fallback, "non-affiliate storefront fallback must not mark links sponsored")
    require("data-affiliate" not in fallback, "non-affiliate storefront fallback must not masquerade as affiliate traffic")
    require("money(" not in fallback and "offer.price" not in fallback, "storefront fallback must not invent or display unverified prices")
    require("affiliate: false" in fallback, "storefront analytics must explicitly mark fallback links non-affiliate")

    for token in ("nc-where-to-buy--sidebar", "nc-storefront-select", "nc-storefront-action", ":focus-visible"):
        require(token in article_css, f"review storefront presentation is missing {token}")

    require("studio-commerce-editor.js" in studio_backend, "Studio backend does not load the storefront editor")
    require("game_key:a.gameKey" in studio_backend and "commercial_meta:a.commercialMeta" in studio_backend, "Studio backend does not persist linked-game and commercial metadata")
    require("where_to_buy_enabled" in studio_js and "gameKey" in studio_js, "Studio local draft model does not preserve review commerce controls")
    require("Link the review to a canonical game" in studio_js, "Studio does not validate the review/game relationship when Where to Buy is enabled")

    for token in ("where-to-buy-enabled", "game-key", "studio-storefront-add", "studio-storefront-save", "metadata", "storefronts", "verifiedAt", "affiliate: false"):
        require(token in studio_commerce, f"Studio storefront editor is missing {token}")
    require("url.protocol === 'https:'" in studio_commerce, "Studio storefront editor does not enforce HTTPS destinations")
    require(".update({ metadata })" in studio_commerce, "Studio storefront editor does not persist canonical game metadata")
    require("...(current.metadata || {})" in studio_commerce, "Studio storefront save does not preserve unrelated game metadata")
    require("entry?.affiliate === true" in studio_commerce and "providerManaged" in studio_commerce, "Studio storefront editor does not preserve provider-managed affiliate entries")
    for prohibited in ("list_price", "availability", "discount", "scarcity"):
        require(f'data-storefront-field="{prohibited}"' not in studio_commerce.lower(), f"Studio direct-storefront editor must not expose a {prohibited} field")
    require("studio-commerce-editor" in studio_commerce_css and ":focus-visible" in studio_commerce_css, "Studio storefront presentation/accessibility styles are incomplete")


def audit_importer_dry_run() -> None:
    sample = {
        "retailers": [{"slug": "audit-retailer", "name": "Audit Retailer"}],
        "products": [{"slug": "audit-product", "name": "Audit Product", "category": "game"}],
        "offers": [{
            "product_slug": "audit-product",
            "retailer_slug": "audit-retailer",
            "external_id": "audit-sku",
            "destination_url": "https://example.invalid/product",
            "price": 10.0,
            "availability": "in_stock",
        }],
    }
    with tempfile.TemporaryDirectory() as temp_dir:
        feed = Path(temp_dir) / "feed.json"
        feed.write_text(json.dumps(sample), encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "import_commerce_feed.py"), "--input", str(feed), "--dry-run"],
            capture_output=True,
            text=True,
            check=False,
        )
    require(result.returncode == 0, f"importer dry-run failed: {result.stderr.strip()}")
    payload = json.loads(result.stdout)
    require(payload.get("ok") is True and payload.get("offers") == 1, "importer dry-run returned unexpected result")


def main() -> int:
    audit_surface()
    audit_schema()
    audit_client_safety()
    audit_importer_dry_run()
    print("Commerce Price Intelligence audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
