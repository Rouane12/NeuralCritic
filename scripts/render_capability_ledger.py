#!/usr/bin/env python3
"""Render the human-readable 200-capability ledger from its canonical CSV."""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs" / "CAPABILITY_STATUS.csv"
MD_PATH = ROOT / "docs" / "CAPABILITY_STATUS.md"
START = "<!-- CAPABILITY_LEDGER_START -->"
END = "<!-- CAPABILITY_LEDGER_END -->"


def cell(value: object) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def render(rows: list[dict[str, str]]) -> str:
    statuses = Counter(row["status"] for row in rows)
    levels = Counter(row["verification_level"] for row in rows)
    lines = [
        START,
        "",
        "## Current inventory",
        "",
        f"Inventory date: `{rows[0]['last_verified'] if rows else 'not populated'}`. Canonical data source: `docs/CAPABILITY_STATUS.csv`.",
        "",
        "| ✅ | 🟡 | ❌ | 🚫 | Total |",
        "|---:|---:|---:|---:|---:|",
        f"| {statuses['✅']} | {statuses['🟡']} | {statuses['❌']} | {statuses['🚫']} | {len(rows)} |",
        "",
        "| V0 | V1 | V2 | V3 | V4 | V5 |",
        "|---:|---:|---:|---:|---:|---:|",
        f"| {levels['V0']} | {levels['V1']} | {levels['V2']} | {levels['V3']} | {levels['V4']} | {levels['V5']} |",
        "",
        "## Status extracts",
        "",
        "### Genuinely missing",
        "",
    ]
    missing = [row for row in rows if row["status"] == "❌"]
    if missing:
        lines.extend(f"- `{cell(row['capability_id'])}` — {cell(row['capability'])}" for row in missing)
    else:
        lines.append("None.")
    lines.extend(["", "### Partial, weaker, or unverified", ""])
    partial_domains: list[str] = []
    for row in rows:
        if row["status"] == "🟡" and row["domain"] not in partial_domains:
            partial_domains.append(row["domain"])
    if partial_domains:
        for domain in partial_domains:
            entries = [
                f"`{cell(row['capability_id'])}` {cell(row['capability'])}"
                for row in rows
                if row["status"] == "🟡" and row["domain"] == domain
            ]
            lines.append(f"- **{cell(domain)}:** " + "; ".join(entries))
    else:
        lines.append("None.")
    lines.extend(["", "### Intentionally not required", ""])
    skipped = [row for row in rows if row["status"] == "🚫"]
    if skipped:
        lines.extend(f"- `{cell(row['capability_id'])}` — {cell(row['capability'])}" for row in skipped)
    else:
        lines.append("None. No explicit product-owner exclusion decision was supplied for Milestone 1.")
    lines.append("")
    current_domain = None
    for index, row in enumerate(rows):
        if row["domain"] != current_domain:
            current_domain = row["domain"]
            lines.extend(
                [
                    f"### {cell(current_domain)}",
                    "",
                    "| ID | Capability | Benchmark → Neural Critic | Status | Level | Owner | Evidence | Limitations | Dependencies | Risk |",
                    "|---|---|---|:---:|:---:|---|---|---|---|:---:|",
                ]
            )
        behavior = f"{cell(row['benchmark_behavior'])} → {cell(row['neural_critic_equivalent'])}"
        lines.append(
            "| " + " | ".join(
                [
                    cell(row["capability_id"]),
                    cell(row["capability"]),
                    behavior,
                    cell(row["status"]),
                    cell(row["verification_level"]),
                    cell(row["owner_files"]),
                    cell(row["evidence"]),
                    cell(row["known_limitations"]),
                    cell(row["dependencies"]),
                    cell(row["regression_risk"]),
                ]
            ) + " |"
        )
        if index < len(rows) - 1 and rows[index + 1]["domain"] != current_domain:
            lines.append("")
    lines.extend(["", END, ""])
    return "\n".join(lines)


def updated_document(source: str, block: str) -> str:
    if START in source and END in source:
        before = source.split(START, 1)[0].rstrip()
        after = source.split(END, 1)[1].lstrip()
        output = f"{before}\n\n{block}"
        if after:
            output += f"\n{after}"
        return output
    return source.rstrip() + "\n\n" + block


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail instead of rewriting if Markdown is stale.")
    args = parser.parse_args()
    with CSV_PATH.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    source = MD_PATH.read_text(encoding="utf-8")
    block = render(rows)
    output = updated_document(source, block)
    if args.check:
        if source != output:
            print("ERROR: docs/CAPABILITY_STATUS.md is stale; run scripts/render_capability_ledger.py", file=sys.stderr)
            return 1
        print(f"Capability Markdown is synchronized with {len(rows)} CSV rows.")
        return 0
    MD_PATH.write_text(output, encoding="utf-8")
    print(f"Rendered {len(rows)} capability rows into {MD_PATH.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
