#!/usr/bin/env python3
"""Build a normalized Neural Critic feed from Amazon Creators API.

The adapter deliberately uses a curated ASIN catalog instead of SearchItems.
Neural Critic owns the durable product metadata in that catalog; Amazon is used
only for short-lived offer/availability data and its tagged detail-page URL.

Required environment variables for live requests:
  AMAZON_CREATORS_CLIENT_ID
  AMAZON_CREATORS_CLIENT_SECRET
  AMAZON_ASSOCIATES_PARTNER_TAG

Optional:
  AMAZON_CREATORS_TOKEN_REGION=NA  # NA, EU, or FE

Amazon offer data is emitted with an expiry shorter than one hour. The commerce
schema disables price-history retention by default, and the database purges
expired offers on a recurring schedule.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

TOKEN_ENDPOINTS = {
    "NA": "https://api.amazon.com/auth/o2/token",
    "EU": "https://api.amazon.co.uk/auth/o2/token",
    "FE": "https://api.amazon.co.jp/auth/o2/token",
}
API_ENDPOINT = "https://creatorsapi.amazon/catalog/v1/getItems"
RESOURCES = [
    "offersV2.listings.availability",
    "offersV2.listings.condition",
    "offersV2.listings.isBuyBoxWinner",
    "offersV2.listings.merchantInfo",
    "offersV2.listings.price",
    "offersV2.listings.type",
]


def request_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Amazon Creators API request failed ({exc.code}): {detail}") from exc


def load_catalog(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Amazon catalog root must be an object")
    marketplace = str(data.get("marketplace") or "www.amazon.com").strip()
    products = data.get("products", [])
    if not isinstance(products, list):
        raise ValueError("Amazon catalog products must be an array")

    seen: set[str] = set()
    for index, product in enumerate(products):
        if not isinstance(product, dict):
            raise ValueError(f"products[{index}] must be an object")
        for key in ("asin", "slug", "name", "category"):
            if not str(product.get(key) or "").strip():
                raise ValueError(f"products[{index}] is missing {key}")
        asin = str(product["asin"]).strip().upper()
        if asin in seen:
            raise ValueError(f"duplicate ASIN {asin}")
        seen.add(asin)
        product["asin"] = asin
    return {"marketplace": marketplace, "products": products}


def access_token() -> str:
    client_id = os.environ.get("AMAZON_CREATORS_CLIENT_ID", "").strip()
    client_secret = os.environ.get("AMAZON_CREATORS_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("Amazon Creators API credentials are not configured")
    region = os.environ.get("AMAZON_CREATORS_TOKEN_REGION", "NA").strip().upper()
    endpoint = TOKEN_ENDPOINTS.get(region)
    if not endpoint:
        raise ValueError("AMAZON_CREATORS_TOKEN_REGION must be NA, EU, or FE")
    response = request_json(endpoint, {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "creatorsapi::default",
    }, {})
    token = str(response.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("Amazon token response did not include access_token")
    return token


def batches(values: list[str], size: int = 10):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def availability(value: str) -> str:
    normalized = str(value or "").replace("_", "").upper()
    if normalized in {"INSTOCK", "INSTOCKSCARCE", "LEADTIME"}:
        return "in_stock"
    if normalized in {"PREORDER", "AVAILABLEDATE"}:
        return "preorder"
    if normalized in {"OUTOFSTOCK", "UNAVAILABLE"}:
        return "out_of_stock"
    return "unknown"


def condition(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized == "new":
        return "new"
    if normalized in {"used", "collectible"}:
        return "used"
    if normalized in {"refurbished", "renewed"}:
        return "refurbished"
    return "unknown"


def get_items(asins: list[str], marketplace: str, partner_tag: str, token: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for batch in batches(asins, 10):
        response = request_json(API_ENDPOINT, {
            "itemIds": batch,
            "itemIdType": "ASIN",
            "marketplace": marketplace,
            "partnerTag": partner_tag,
            "resources": RESOURCES,
        }, {
            "Authorization": f"Bearer {token}",
            "x-marketplace": marketplace,
        })
        items.extend((response.get("itemsResult") or {}).get("items") or [])
    return items


def build_feed(catalog: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    marketplace = catalog["marketplace"]
    retailer_slug = "amazon-" + marketplace.replace("www.amazon.", "").replace(".", "-")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=55)
    item_map = {str(item.get("asin") or "").upper(): item for item in items}

    products: list[dict[str, Any]] = []
    offers: list[dict[str, Any]] = []
    for source in catalog["products"]:
        asin = source["asin"]
        product = {
            key: source[key]
            for key in ("slug", "name", "category", "product_type", "brand", "model", "platform", "msrp", "currency", "specs", "featured", "active")
            if key in source
        }
        specs = dict(product.get("specs") or {})
        specs["asin"] = asin
        product["specs"] = specs
        products.append(product)

        item = item_map.get(asin)
        if not item:
            continue
        detail_url = str(item.get("detailPageURL") or "").strip()
        listings = (item.get("offersV2") or {}).get("listings") or []
        listing = next((entry for entry in listings if entry.get("isBuyBoxWinner")), None) or (listings[0] if listings else None)
        if not listing or not detail_url or listing.get("violatesMAP") is True:
            continue
        price_info = listing.get("price") or {}
        money = price_info.get("money") or {}
        amount = money.get("amount")
        if amount is None:
            continue
        saving_money = (price_info.get("savingBasis") or {}).get("money") or {}
        availability_info = listing.get("availability") or {}
        condition_info = listing.get("condition") or {}
        offers.append({
            "product_slug": source["slug"],
            "retailer_slug": retailer_slug,
            "external_id": asin,
            "destination_url": detail_url,
            "affiliate_url": detail_url,
            "price": amount,
            "list_price": saving_money.get("amount"),
            "currency": money.get("currency") or source.get("currency") or "USD",
            "availability": availability(availability_info.get("type")),
            "item_condition": condition(condition_info.get("value")),
            "region": marketplace,
            "is_affiliate": True,
            "source": "amazon-creators-api",
            "fetched_at": now.isoformat(),
            "expires_at": expires.isoformat(),
            "metadata": {
                "provider": "amazon-creators-api",
                "asin": asin,
                "merchant": (listing.get("merchantInfo") or {}).get("name"),
                "offer_cache_ttl_minutes": 60,
            },
        })

    return {
        "retailers": [{
            "slug": retailer_slug,
            "name": "Amazon",
            "homepage_url": f"https://{marketplace}/",
            "affiliate_network": "amazon-associates",
            "region": marketplace,
            "active": True,
            "metadata": {
                "provider": "amazon-creators-api",
                "price_history_mode": "disabled",
                "offer_cache_ttl_minutes": 60,
            },
        }],
        "products": products,
        "offers": offers,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Neural Critic feed from Amazon Creators API")
    parser.add_argument("--catalog", default="data/commerce/amazon_catalog.json")
    parser.add_argument("--output", default="-")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    try:
        catalog = load_catalog(args.catalog)
        if args.validate_only or not catalog["products"]:
            result = {"retailers": [], "products": [], "offers": []}
        else:
            partner_tag = os.environ.get("AMAZON_ASSOCIATES_PARTNER_TAG", "").strip()
            if not partner_tag:
                raise RuntimeError("AMAZON_ASSOCIATES_PARTNER_TAG is not configured")
            token = access_token()
            items = get_items([row["asin"] for row in catalog["products"]], catalog["marketplace"], partner_tag, token)
            result = build_feed(catalog, items)

        encoded = json.dumps(result, indent=2)
        if args.output == "-":
            print(encoded)
        else:
            Path(args.output).write_text(encoded + "\n", encoding="utf-8")
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
