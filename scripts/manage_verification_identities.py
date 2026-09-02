#!/usr/bin/env python3
"""Provision or remove tightly-scoped Neural Critic verification identities.

This operator-only helper never belongs in browser code and never prints or
stores passwords or service-role credentials. It changes no schema or policy.
Provisioning requires the existing project, existing RLS-protected tables, a
server-side service-role credential, and two explicit confirmation values.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "assets" / "supabase-config.js"
MANIFEST = ROOT / ".verification" / "identities.json"
ROLES = ("reader", "editor", "admin")
PROVISION_CONFIRMATION = "CREATE_NC_VERIFICATION_IDENTITIES"
CLEANUP_CONFIRMATION = "DELETE_NC_VERIFICATION_IDENTITIES"


def project() -> tuple[str, str]:
    source = CONFIG.read_text(encoding="utf-8")
    match = re.search(r"url:\s*['\"]https://([a-z0-9-]+)\.supabase\.co['\"]", source)
    if not match:
        raise RuntimeError("Could not determine the configured Supabase project.")
    ref = match.group(1)
    return ref, f"https://{ref}.supabase.co"


def env_name(role: str, field: str) -> str:
    return f"NC_VERIFY_{role.upper()}_{field.upper()}"


def validate_email(value: str, role: str) -> None:
    local, separator, domain = value.partition("@")
    if not separator or not domain or "." not in domain:
        raise RuntimeError(f"{role}: verification email is not syntactically valid.")
    if not (local.startswith("nc-verify-") or "+nc-verify-" in local):
        raise RuntimeError(
            f"{role}: email must use an nc-verify- local part or +nc-verify- alias."
        )


def credentials() -> list[dict[str, str]]:
    identities: list[dict[str, str]] = []
    for role in ROLES:
        email = os.environ.get(env_name(role, "email"), "").strip().lower()
        password = os.environ.get(env_name(role, "password"), "")
        if not email or not password:
            raise RuntimeError(
                f"Missing {env_name(role, 'email')} or {env_name(role, 'password')}."
            )
        validate_email(email, role)
        if len(password) < 16:
            raise RuntimeError(f"{role}: verification password must be at least 16 characters.")
        identities.append(
            {
                "role": role,
                "email": email,
                "password": password,
                "display_name": f"NC Verify {role.title()}",
            }
        )
    if len({item["email"] for item in identities}) != len(identities):
        raise RuntimeError("Verification roles must use distinct email addresses.")
    return identities


def service_key() -> str:
    value = os.environ.get("NC_VERIFY_SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not value:
        raise RuntimeError("Missing NC_VERIFY_SUPABASE_SERVICE_ROLE_KEY.")
    return value


def request(
    base_url: str,
    key: str,
    method: str,
    path: str,
    payload: object | None = None,
    extra_headers: dict[str, str] | None = None,
    allow_not_found: bool = False,
) -> Any:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "NeuralCritic-VerificationIdentityManager/1.0",
    }
    headers.update(extra_headers or {})
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    call = urllib.request.Request(f"{base_url}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(call, timeout=30) as response:
            raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        if allow_not_found and exc.code == 404:
            return None
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed with HTTP {exc.code}: {detail[:300]}") from exc


def create_auth_identity(base_url: str, key: str, item: dict[str, str]) -> dict[str, str]:
    created = request(
        base_url,
        key,
        "POST",
        "/auth/v1/admin/users",
        {
            "email": item["email"],
            "password": item["password"],
            "email_confirm": True,
            "app_metadata": {
                "nc_verification_fixture": True,
                "nc_verification_role": item["role"],
            },
            "user_metadata": {"display_name": item["display_name"]},
        },
    )
    user_id = str((created or {}).get("id") or "")
    if not user_id:
        raise RuntimeError(f"Supabase did not return an ID for the {item['role']} identity.")
    return {"id": user_id, "email": item["email"], "role": item["role"]}


def configure_profiles(
    base_url: str,
    key: str,
    item: dict[str, str],
    identity: dict[str, str],
) -> None:
    user_id = identity["id"]
    request(
        base_url,
        key,
        "POST",
        "/rest/v1/reader_profiles?on_conflict=user_id",
        [{"user_id": user_id, "display_name": item["display_name"], "avatar_url": None}],
        {"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    if item["role"] in {"editor", "admin"}:
        request(
            base_url,
            key,
            "POST",
            "/rest/v1/editor_profiles?on_conflict=user_id",
            [
                {
                    "user_id": user_id,
                    "display_name": item["display_name"],
                    "role": item["role"],
                }
            ],
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )


def write_manifest(project_ref: str, identities: list[dict[str, str]]) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(
            {
                "project_ref": project_ref,
                "marker": "nc_verification_fixture",
                "identities": identities,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def provision(args: argparse.Namespace) -> int:
    project_ref, base_url = project()
    if args.confirm_project != project_ref:
        raise RuntimeError(f"Pass --confirm-project {project_ref} to target the configured project.")
    if args.confirm != PROVISION_CONFIRMATION:
        raise RuntimeError(f"Pass --confirm {PROVISION_CONFIRMATION} to provision identities.")
    if MANIFEST.exists():
        raise RuntimeError(f"Refusing to provision while {MANIFEST.relative_to(ROOT)} already exists.")
    key = service_key()
    created: list[dict[str, str]] = []
    try:
        for item in credentials():
            identity = create_auth_identity(base_url, key, item)
            created.append(identity)
            # Persist the ID before profile writes so any partially configured
            # Auth user remains safely addressable by the guarded cleanup path.
            write_manifest(project_ref, created)
            configure_profiles(base_url, key, item, identity)
    except Exception:
        if created:
            write_manifest(project_ref, created)
            print(
                "Partial provisioning manifest written; run guarded cleanup before retrying.",
                file=sys.stderr,
            )
        raise
    write_manifest(project_ref, created)
    print(f"Provisioned {len(created)} marked verification identities; no passwords were stored.")
    return 0


def cleanup(args: argparse.Namespace) -> int:
    project_ref, base_url = project()
    if args.confirm_project != project_ref:
        raise RuntimeError(f"Pass --confirm-project {project_ref} to target the configured project.")
    if args.confirm != CLEANUP_CONFIRMATION:
        raise RuntimeError(f"Pass --confirm {CLEANUP_CONFIRMATION} to remove identities.")
    if not MANIFEST.is_file():
        raise RuntimeError(f"No {MANIFEST.relative_to(ROOT)} manifest; refusing broad user deletion.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("project_ref") != project_ref or manifest.get("marker") != "nc_verification_fixture":
        raise RuntimeError("Manifest project/marker does not match the configured verification contract.")
    identities = manifest.get("identities")
    if not isinstance(identities, list) or not identities:
        raise RuntimeError("Manifest contains no explicit identity IDs; refusing cleanup.")
    key = service_key()
    for item in identities:
        user_id = str(item.get("id") or "") if isinstance(item, dict) else ""
        if not re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            user_id,
            flags=re.I,
        ):
            raise RuntimeError("Manifest contains an invalid user ID; refusing cleanup.")
        current = request(
            base_url,
            key,
            "GET",
            f"/auth/v1/admin/users/{user_id}",
            allow_not_found=True,
        )
        if current is None:
            continue
        metadata = current.get("app_metadata") if isinstance(current, dict) else None
        expected_email = str(item.get("email") or "").lower()
        current_email = str(current.get("email") or "").lower() if isinstance(current, dict) else ""
        if not isinstance(metadata, dict) or metadata.get("nc_verification_fixture") is not True:
            raise RuntimeError("A manifest user lacks the immutable verification marker; refusing deletion.")
        if current_email != expected_email:
            raise RuntimeError("A manifest user email no longer matches; refusing deletion.")
        request(
            base_url,
            key,
            "DELETE",
            f"/auth/v1/admin/users/{user_id}",
            allow_not_found=True,
        )
    MANIFEST.unlink()
    print(f"Removed {len(identities)} manifest-scoped verification identities.")
    return 0


def plan() -> int:
    project_ref, _ = project()
    print("Neural Critic verification identity plan (no network calls, no writes)")
    print(f"Project confirmation: --confirm-project {project_ref}")
    for role in ROLES:
        print(f"{role}: {env_name(role, 'email')} + {env_name(role, 'password')}")
    print("Server-only credential: NC_VERIFY_SUPABASE_SERVICE_ROLE_KEY")
    print(f"Provision confirmation: --confirm {PROVISION_CONFIRMATION}")
    print(f"Cleanup confirmation: --confirm {CLEANUP_CONFIRMATION}")
    print(f"Manifest: {MANIFEST.relative_to(ROOT)} (IDs/emails/roles only; gitignored)")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("plan", "provision", "cleanup"))
    parser.add_argument("--confirm-project", default="")
    parser.add_argument("--confirm", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.command == "plan":
            return plan()
        if args.command == "provision":
            return provision(args)
        return cleanup(args)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
