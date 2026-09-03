# Neural Critic Overhaul — Milestone 1 report

- Branch: `overhaul/baseline-regression-safety`
- Evidence date: `2026-09-02`
- Scope: 200-capability inventory and verification environment only

## Outcome

All 200 stable capability IDs are populated with benchmark behavior, Neural Critic equivalent, current owner/files, status, V0–V5 level, entry/data/journey, evidence, limitations, dependencies, regression risk, date, and notes. No public redesign, new benchmark feature, database migration, RLS change, content rewrite, or product-gap repair is part of this milestone.

| Status | Count |
|---|---:|
| ✅ Complete and verified | 126 |
| 🟡 Existing but partial / weaker / unverified | 68 |
| ❌ Missing | 6 |
| 🚫 Intentionally not required | 0 |
| **Total** | **200** |

| V0 | V1 | V2 | V3 | V4 | V5 |
|---:|---:|---:|---:|---:|---:|
| 0 | 6 | 113 | 77 | 3 | 1 |

The complete row-level inventory and the explicit list of all 68 partial capabilities are in `docs/CAPABILITY_STATUS.md`; the canonical machine-readable source is `docs/CAPABILITY_STATUS.csv`.

## Architecture confirmed

Neural Critic is a framework-free GitHub Pages publication whose shared JavaScript runtimes hydrate static templates. Published Supabase rows are the live article source; `assets/content-api.js` maps them into the same shape as the repository-generated index/detail JSON fallback. Builders generate clean canonical story shells, topic/series/franchise hubs, game pages, author pages, sitemap, RSS, and robots state. The clean `/stories/<slug>/` shells and legacy `article.html?slug=<slug>` route share one article runtime.

Editorial Studio, Newsroom, and Subscriber Desk use Supabase Auth plus editor/admin data and RLS/Edge checks. Reader auth, profiles/avatar Storage, comments/reactions/replies, saved stories, author/entity follows, and Following feed are layered existing clients. Discovery Intelligence, Related/Connected Coverage, Recirculation, Popularity, Game Graph, newsletter, commerce, consent/analytics, SEO/schema, and GitHub publication workflows all have existing owners recorded in the ledger. Future work must extend those owners rather than duplicate them.

## Genuinely missing capabilities

- `NC-GS-009` — Video programming module
- `NC-GS-060` — Structured comparison or buying-guide format
- `NC-GS-109` — Recently viewed history
- `NC-GS-110` — Per-user recommendations beyond explicit follows
- `NC-GS-128` — Article Dislike
- `NC-GS-140` — Reader newsletter content preferences

Each ❌ row includes a named `E-NEG-*` repository search. None is authorized for implementation by this report.

## Partial capabilities

There are 68 🟡 rows. The generated “Partial, weaker, or unverified” section in `docs/CAPABILITY_STATUS.md` lists every ID/name grouped by domain. The largest blocks are authenticated reader persistence (`NC-GS-112`–`120`), community writes (`122`–`127`), newsletter/provider journeys (`131`–`139`), Studio (`172`–`180`), Newsroom/admin (`182`–`189`), and RLS/accessibility/mobile verification (`192`, `196`, `197`, `199`). Other partial rows record specific data gaps, unexercised interactions, or the legacy canonical bug; none is silently classified complete.

## Intentionally skipped capabilities

None. 🚫 requires an explicit product-owner decision, rationale, approver, and date; no such exclusion was supplied.

## Verified pre-existing bugs and fragile gaps

- `BUG-M1-01`: legacy `article.html?slug=…` can finish with the query route in canonical and `og:url`; clean story shells remain correct. The race is between existing hardening/router owners.
- `BUG-M1-02`: runtime hardening overwrites `/games/` and `/reviews/` document titles with the homepage title.
- `BUG-M1-03`: private tooling pages emit a Supabase multiple-GoTrue-client warning for the same storage key.
- Game identity exists on 39/53 stories (14 absent), while 23 populated game keys have no current Games Database record; only 7 full game pages exist.
- Three reviews lack tested-platform metadata.
- RSS contains the newest 30 of 53 stories and uses a non-deterministic `lastBuildDate`.
- Original migrations for several mature base tables are absent, preventing a faithful fresh local Supabase recreation.
- The observed Upcoming game-directory state contains zero mapped game records.

All are pre-existing. No branch-introduced public bug was identified. This milestone deliberately did not repair them.

## Verification environment and identities

No reader, editor, or admin identity was created: this workspace had no safe non-personal credentials, service-role authority, complete local Supabase schema, or approved staging environment. No personal credential was requested or entered.

`scripts/manage_verification_identities.py` supplies a guarded operator path for a later authorized environment. Its `plan` command performs no network call/write. Provisioning requires three `nc-verify` addresses, 16+ character environment-only passwords, a server-only service-role environment variable, the exact configured project ref, and an explicit phrase. It changes no schema/RLS and writes only a gitignored ID/email/role manifest. Cleanup refuses broad deletion and can remove only manifest-scoped users.

## Capabilities still impossible to verify here

- Authenticated reader V4 flows: signup/sign-in/session/profile/avatar/sign-out, article Like, comments/edit/delete/reply/votes, Save, author/game/series/franchise follows, and Following feed.
- OAuth/password recovery because no provider fixture, callback identity, or synthetic mailbox was available.
- Editor/admin V4–V5 flows: Studio draft/save/schedule/publish/media/Game Graph, Newsroom workflow/audit, Subscriber Desk mutations, moderation, and role-negative paths.
- Newsletter delivery/unsubscribe and commerce provider ingestion/expiry jobs because provider authority was unavailable.
- Full live RLS positive/negative matrix because role fixtures/service authority and complete base migrations were unavailable.
- Real mobile viewport and screen-reader journeys because the connected browser exposed no supported viewport/accessibility-tree control.
- Browser behavior and GitHub Actions for the exact branch commit because the branch is not deployed or pushed; public browser evidence represents current `main`.

## Canonical and live/fallback investigation

- Live/fallback parity: 53 live published rows = 53 fallback rows, with exact order and row equality.
- Repository details: 53 per-story JSON files exactly equal their index row.
- Static canonical shells: 53/53 clean story shells have self-canonical, matching `og:url`, static slug marker, and required runtime owner.
- Browser: clean shell canonical/share behavior is correct; the legacy query-route metadata inconsistency is recorded as `BUG-M1-01`.

## Checks added or strengthened

- `audit_capability_ledger.py`: enforces exactly 200 sequential IDs, every required field, status/level/risk vocabulary, evidence-registry references, specific partial/missing rules, dates, and credential/token hygiene.
- `render_capability_ledger.py`: renders the human ledger and status extracts from the canonical CSV; `--check` fails if Markdown drifts.
- `audit_content_parity.py`: compares live mapped Supabase rows to fallback, every detail row, and every clean story-shell canonical/OG/static-slug contract; supports static-only runs.
- `manage_verification_identities.py`: guarded, server-only fixture lifecycle without weakening authentication or RLS.
- `audit_overhaul_baseline.py`: now requires the final expanded 200-row schema, sequential IDs, complete fields, statuses, and levels.
- Publication health watches/runs the new ledger/parity contract and parse-checks the fixture tooling.

## Files changed

- `.github/workflows/publication-health.yml` — watches and runs the new verification contracts.
- `.gitignore` — excludes the credential-free but identity-bearing local fixture manifest directory.
- `README.md` — links the ledger/evidence/runbook and verification commands.
- `docs/CAPABILITY_STATUS.csv` — canonical 200-row evidence ledger.
- `docs/CAPABILITY_STATUS.md` — final V0–V5 model, methodology, counts, explicit status extracts, and readable 200-row inventory.
- `docs/OVERHAUL_BASELINE.md` — preserves the Milestone 0 contract and adds the Milestone 1 evidence boundary.
- `docs/VERIFICATION_EVIDENCE.md` — reproducible evidence registry, browser findings, known bugs/gaps, and validation record.
- `docs/VERIFICATION_ENVIRONMENT.md` — safe reader/editor/admin fixture and persistent-journey runbook.
- `docs/MILESTONE_1_REPORT.md` — this completion report.
- `scripts/audit_capability_ledger.py` — ledger quality gate.
- `scripts/audit_content_parity.py` — live/fallback/canonical parity gate.
- `scripts/manage_verification_identities.py` — guarded operator-only fixture lifecycle.
- `scripts/render_capability_ledger.py` — deterministic CSV-to-Markdown renderer/checker.
- `scripts/audit_overhaul_baseline.py` — expanded ledger contract.

No public HTML, CSS, runtime JavaScript, content JSON, generated canonical page, migration, Edge Function, sitemap, RSS, or product behavior is intentionally changed.

## Validation result

- Eight publication builders completed: 53 live/fallback articles, 53 canonical story shells, 72 topic hubs, 7 game pages, 1 author hub, and metadata enrichment for 53/53 shells. The expected non-deterministic RSS timestamp drift was discarded, leaving no generated-content diff.
- All 20 `scripts/audit_*.py` checks exited 0.
- Known non-failing warnings remained: three missing tested platforms, 23 missing game database mappings, and 23 stories outside the 30-item RSS cap.
- Live parity exited 0 with `live=53, fallback=53, details=53, shells=53`.
- Ledger audit exited 0 with the counts above; Markdown synchronization exited 0.
- All 89 JavaScript files passed `node --check`; all 34 Python scripts compiled; all 6 workflow YAML files parsed.
- `git diff --cached --check` passed; the final file-by-file diff/secret/public-surface review found no intentional redesign or client-side privileged credential.
- Signed-out desktop browser routes, representative story/review/thread/search/game/topic pages, private gates, share/copy behavior, and theme persistence were exercised. Site-origin findings are recorded rather than hidden.

## Recommendation for Milestone 2

Use a bounded **Protected Runtime Integrity & Auth Verification Closure** milestone before visual or feature work:

1. Provision disposable reader/editor/admin fixtures in an authorized staging or production-equivalent environment and run the full V4/V5 persistence/RLS matrix with cleanup.
2. Give canonical identity one explicit owner/order and fix `BUG-M1-01` with dual-route metadata regression coverage.
3. Correct nested directory title hardening and consolidate private-page Supabase client ownership only after targeted regression tests reproduce `BUG-M1-02`/`03`.
4. Update affected ledger rows from fresh evidence; do not add any of the six missing benchmark capabilities yet.

That closes the highest-risk uncertainty around protected routes, identity, and authorization before any reader-journey redesign begins.
