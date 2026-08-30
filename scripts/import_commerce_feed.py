#!/usr/bin/env python3
"""Import a normalized Neural Critic commerce feed into Supabase.

This script is server-side tooling. Never expose SUPABASE_SERVICE_ROLE_KEY in the
browser or commit it to the repository.

Feed shape:
{
  "retailers": [{"slug":"store","name":"Store", ...}],
  "products": [{"slug":"product","name":"Product","category":"game","game_slug":"optional", ...}],
  "offers": [{"product_slug":"product","retailer_slug":"store","external_id":"sku","destination_url":"https://...","price":49.99, ...}]
}

The database trigger captures commerce_price_history automatically when an
inserted/upserted offer changes price, list price, or availability.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ALLOWED_CATEGORIES = {
    "game", "hardware", "component", "storage", "display", "input",
    "audio", "controller", "accessory", "other",
}
ALLOWED_AVAILABILITY = {"in_stock", "out_of_stock", "preorder", "backorder", "unknown"}
ALLOWED_CONDITIONS = {"new", "used", "refurbished", "digital", "unknown"}


def load_feed(path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Feed root must be a JSON object")
    for key in ("retailers", "products", "offers"):
        if not isinstance(data.get(key, []), list):
            raise ValueError(f"{key} must be an array")
    return data


def require_text(row: dict[str, Any], key: str, context: str) -> str:
    value = str(row.get(key) or "").strip()
    if not value:
        raise ValueError(f"{context}: missing {key}")
    return value


def validate(feed: dict[str, Any]) -> None:
    retailer_slugs: set[str] = set()
    product_slugs: set[str] = set()

    for index, row in enumerate(feed.get("retailers", [])):
        if not isinstance(row, dict):
            raise ValueError(f"retailers[{index}] must be an object")
        slug = require_text(row, "slug", f"retailers[{index}]")
        require_text(row, "name", f"retailers[{index}]")
        if slug in retailer_slugs:
            raise ValueError(f"Duplicate retailer slug: {slug}")
        retailer_slugs.add(slug)

    for index, row in enumerate(feed.get("products", [])):
        if not isinstance(row, dict):
            raise ValueError(f"products[{index}] must be an object")
        slug = require_text(row, "slug", f"products[{index}]")
        require_text(row, "name", f"products[{index}]")
        category = str(row.get("category") or "other").strip().lower()
        if category not in ALLOWED_CATEGORIES:
            raise ValueError(f"products[{index}]: unsupported category {category!r}")
        if slug in product_slugs:
            raise ValueError(f"Duplicate product slug: {slug}")
        product_slugs.add(slug)

    for index, row in enumerate(feed.get("offers", [])):
        if not isinstance(row, dict):
            raise ValueError(f"offers[{index}] must be an object")
        product_slug = require_text(row, "product_slug", f"offers[{index}]")
        retailer_slug = require_text(row, "retailer_slug", f"offers[{index}]")
        require_text(row, "destination_url", f"offers[{index}]")
        if product_slug not in product_slugs:
            raise ValueError(f"offers[{index}]: unknown product_slug {product_slug!r}")
        if retailer_slug not in retailer_slugs:
            raise ValueError(f"offers[{index}]: unknown retailer_slug {retailer_slug!r}")
        try:
            price = float(row.get("price"))
        except (TypeError, ValueError):
            raise ValueError(f"offers[{index}]: price must be numeric") from None
        if price < 0:
            raise ValueError(f"offers[{index}]: price cannot be negative")
        availability = str(row.get("availability") or "unknown").lower()
        condition = str(row.get("item_condition") or "new").lower()
        if availability not in ALLOWED_AVAILABILITY:
            raise ValueError(f"offers[{index}]: unsupported availability {availability!r}")
        if condition not in ALLOWED_CONDITIONS:
            raise ValueError(f"offers[{index}]: unsupported item_condition {condition!r}")


class SupabaseRest:
    def __init__(self, url: str, service_key: str) -> None:
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_key,
            "authorization": f"Bearer {service_key}",
            "content-type": "application/json",
        }

    def request(self, method: str, path: str, payload: Any | None = None, prefer: str | None = None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["prefer"] = prefer
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(self.base + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {path} failed ({exc.code}): {detail}") from exc

    def select(self, table: str, columns: str) -> list[dict[str, Any]]:
        path = f"/{table}?select={urllib.parse.quote(columns, safe=',') }"
        data = self.request("GET", path)
        return data or []

    def upsert(self, table: str, rows: list[dict[str, Any]], conflict: str) -> list[dict[str, Any]]:
        if not rows:
            return []
        path = f"/{table}?on_conflict={urllib.parse.quote(conflict)}"
        data = self.request("POST", path, rows, "resolution=merge-duplicates,return=representation")
        return data or []


def clean_row(row: dict[str, Any], allowed: set[str]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key in allowed and value is not None}


def import_feed(feed: dict[str, Any], api: SupabaseRest, dry_run: bool = False) -> dict[str, int]:
    games = {row["slug"]: row["id"] for row in api.select("games", "id,slug")} if not dry_run else {}

    retailers = [clean_row(row, {
        "slug", "name", "homepage_url", "affiliate_network", "region", "active", "metadata"
    }) for row in feed.get("retailers", [])]

    products: list[dict[str, Any]] = []
    for source in feed.get("products", []):
        row = clean_row(source, {
            "slug", "name", "category", "product_type", "brand", "model", "platform",
            "image_url", "image_alt", "msrp", "currency", "specs", "featured", "active",
        })
        row["category"] = str(row.get("category") or "other").lower()
        game_slug = str(source.get("game_slug") or "").strip()
        if game_slug:
            if not dry_run and game_slug not in games:
                raise ValueError(f"Product {row['slug']!r} references unknown game_slug {game_slug!r}")
            if not dry_run:
                row["game_id"] = games[game_slug]
        products.append(row)

    if dry_run:
        return {"retailers": len(retailers), "products": len(products), "offers": len(feed.get("offers", []))}

    retailer_rows = api.upsert("commerce_retailers", retailers, "slug")
    product_rows = api.upsert("commerce_products", products, "slug")
    retailer_ids = {row["slug"]: row["id"] for row in retailer_rows}
    product_ids = {row["slug"]: row["id"] for row in product_rows}

    # Merge in existing IDs in case PostgREST returned only changed rows under a future configuration.
    retailer_ids.update({row["slug"]: row["id"] for row in api.select("commerce_retailers", "id,slug")})
    product_ids.update({row["slug"]: row["id"] for row in api.select("commerce_products", "id,slug")})

    now = datetime.now(timezone.utc).isoformat()
    offers: list[dict[str, Any]] = []
    for source in feed.get("offers", []):
        product_slug = source["product_slug"]
        retailer_slug = source["retailer_slug"]
        row = clean_row(source, {
            "external_id", "destination_url", "affiliate_url", "price", "list_price", "currency",
            "availability", "item_condition", "region", "is_affiliate", "source", "fetched_at",
            "expires_at", "metadata",
        })
        row["product_id"] = product_ids[product_slug]
        row["retailer_id"] = retailer_ids[retailer_slug]
        row["fetched_at"] = row.get("fetched_at") or now
        row["availability"] = str(row.get("availability") or "unknown").lower()
        row["item_condition"] = str(row.get("item_condition") or "new").lower()
        offers.append(row)

    # Retailer + external_id is the durable offer identity. Every real feed adapter
    # should provide external_id (SKU/ASIN/deal id) so refreshes update rather than duplicate.
    missing_external = [row for row in offers if not str(row.get("external_id") or "").strip()]
    if missing_external:
        raise ValueError("Every imported offer must include external_id for safe idempotent upserts")

    api.upsert("commerce_offers", offers, "retailer_id,external_id")
    return {"retailers": len(retailers), "products": len(products), "offers": len(offers)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a normalized Neural Critic commerce feed")
    parser.add_argument("--input", required=True, help="JSON file path or - for stdin")
    parser.add_argument("--dry-run", action="store_true", help="Validate and summarize without writing")
    args = parser.parse_args()

    try:
        feed = load_feed(args.input)
        validate(feed)
        if args.dry_run:
            counts = {"retailers": len(feed.get("retailers", [])), "products": len(feed.get("products", [])), "offers": len(feed.get("offers", []))}
        else:
            url = os.environ.get("SUPABASE_URL", "").strip()
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            if not url or not key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for writes")
            counts = import_feed(feed, SupabaseRest(url, key), dry_run=False)
        print(json.dumps({"ok": True, **counts}, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
