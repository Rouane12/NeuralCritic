#!/usr/bin/env python3
"""Validate the Milestone 1 capability ledger and its evidence contract."""

from __future__ import annotations

import csv
import glob
import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "docs" / "CAPABILITY_STATUS.csv"
EVIDENCE = ROOT / "docs" / "VERIFICATION_EVIDENCE.md"
FIELDS = (
    "capability_id",
    "domain",
    "capability",
    "benchmark_behavior",
    "neural_critic_equivalent",
    "status",
    "verification_level",
    "entry_points",
    "owner_files",
    "data_source",
    "journey",
    "evidence",
    "known_limitations",
    "dependencies",
    "regression_risk",
    "last_verified",
    "milestone",
    "notes",
)
STATUSES = {"✅", "🟡", "❌", "🚫"}
LEVELS = {f"V{value}" for value in range(6)}
RISKS = {"low", "medium", "high", "critical"}
OWNER_EXTENSIONS = (".css", ".html", ".js", ".json", ".py", ".sql", ".ts", ".xml", ".yml")
SECRET_PATTERNS = (
    re.compile(r"sb_secret_[A-Za-z0-9_-]+"),
    re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),
    re.compile(r"(?:password|token|service[_ -]?role)\s*[:=]\s*[^;|,\s]{8,}", re.I),
)


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    evidence_text = EVIDENCE.read_text(encoding="utf-8") if EVIDENCE.is_file() else ""
    with LEDGER.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != FIELDS:
            errors.append("CSV columns do not match the Milestone 1 contract")
        rows = list(reader)

    expected_ids = [f"NC-GS-{value:03d}" for value in range(1, 201)]
    actual_ids = [str(row.get("capability_id") or "") for row in rows]
    if actual_ids != expected_ids:
        errors.append("Capability IDs must be exactly NC-GS-001 through NC-GS-200 in order")
    if len(rows) != 200:
        errors.append(f"Expected 200 capability rows, found {len(rows)}")

    for row in rows:
        capability_id = str(row.get("capability_id") or "<unknown>")
        for field in FIELDS:
            if not str(row.get(field) or "").strip():
                errors.append(f"{capability_id}: empty required field {field}")
        status = str(row.get("status") or "")
        level = str(row.get("verification_level") or "")
        if status not in STATUSES:
            errors.append(f"{capability_id}: invalid status {status!r}")
        if level not in LEVELS:
            errors.append(f"{capability_id}: invalid verification level {level!r}")
        if str(row.get("regression_risk") or "").lower() not in RISKS:
            errors.append(f"{capability_id}: regression risk must be low/medium/high/critical")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(row.get("last_verified") or "")):
            errors.append(f"{capability_id}: last_verified must be an ISO date")
        limitations = str(row.get("known_limitations") or "")
        if status in {"🟡", "❌"} and limitations.lower() in {"none", "none observed"}:
            errors.append(f"{capability_id}: partial/missing rows require a specific limitation")
        if status == "🚫" and "decision" not in str(row.get("notes") or "").lower():
            errors.append(f"{capability_id}: intentionally excluded row lacks a decision record")
        if status == "✅" and level in {"V0", "V1"}:
            errors.append(f"{capability_id}: complete status requires deterministic or runtime proof")
        if status == "❌" and "E-NEG-" not in str(row.get("evidence") or ""):
            errors.append(f"{capability_id}: missing status requires documented negative evidence")

        owner_files = str(row.get("owner_files") or "")
        if owner_files != "none found":
            for owner in (part.strip().split(" ", 1)[0] for part in owner_files.split(";")):
                if not any(extension in owner for extension in OWNER_EXTENSIONS):
                    continue
                matches = glob.glob(str(ROOT / owner)) if "*" in owner else [str(ROOT / owner)]
                if not matches or not all(Path(match).exists() for match in matches):
                    errors.append(f"{capability_id}: owner path does not resolve: {owner}")

        evidence_ids = re.findall(r"E-[A-Z0-9-]+", str(row.get("evidence") or ""))
        if not evidence_ids:
            errors.append(f"{capability_id}: no evidence ID")
        for evidence_id in evidence_ids:
            if f"### {evidence_id}" not in evidence_text:
                errors.append(f"{capability_id}: undefined evidence ID {evidence_id}")

        joined = " | ".join(str(row.get(field) or "") for field in FIELDS)
        for pattern in SECRET_PATTERNS:
            if pattern.search(joined):
                errors.append(f"{capability_id}: possible credential or token in ledger")

    statuses = Counter(row.get("status") for row in rows)
    levels = Counter(row.get("verification_level") for row in rows)
    if statuses.get("🚫", 0):
        warnings.append("Intentionally-not-required rows exist; confirm each product decision")

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    status_summary = ", ".join(f"{key}={statuses.get(key, 0)}" for key in ("✅", "🟡", "❌", "🚫"))
    level_summary = ", ".join(f"V{value}={levels.get(f'V{value}', 0)}" for value in range(6))
    print(f"Capability ledger audit: {len(errors)} error(s), {len(warnings)} warning(s); {status_summary}; {level_summary}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
