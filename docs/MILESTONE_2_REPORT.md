# Neural Critic Overhaul — Milestone 2 report

- Branch: `overhaul/baseline-regression-safety`
- Evidence date: `2026-09-02`
- Scope: Protected Runtime Integrity & Auth Verification Closure

## Entry gate

Milestone 2 started only after the requested Milestone 1 gate passed:

```bash
python scripts/audit_capability_ledger.py
python scripts/render_capability_ledger.py --check
```

The canonical `docs/CAPABILITY_STATUS.csv` contained exactly `200` data rows, `200` unique sequential IDs from `NC-GS-001` through `NC-GS-200`, and synchronized Markdown. The same commands pass on the final Milestone 2 state.

## Outcome

This milestone closes the three bounded protected-runtime defects recommended by Milestone 1 and strengthens read-only authorization evidence without redesigning the site or adding a benchmark capability.

| Finding | Branch result | Proof boundary |
|---|---|---|
| `BUG-M1-01` legacy canonical race | Story Router is the explicit runtime canonical owner; hardening consumes its clean story URL for canonical, Open Graph, Article schema, and Breadcrumb schema. | Reproduced before the fix and passed after it in the real-module deterministic harness; exact-branch deployed browser verification remains pending. |
| `BUG-M1-02` nested directory title overwrite | Homepage metadata is applied only when the real homepage hero and story-feed surfaces exist. | `/games/`, `/reviews/`, and the real homepage are covered by deterministic module execution; deployed browser verification remains pending. |
| `BUG-M1-03` duplicate private Supabase clients | The private config creates one singleton; Newsroom dashboard and guards reuse it. | Creation count, consumer source, and HTML load order are deterministic checks; deployed private-page console verification remains pending. |

The 200-capability totals remain deliberately unchanged because the new evidence does not justify promoting unverified authenticated or post-deployment browser journeys.

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

## Protected-runtime implementation

- `assets/story-router.js` publishes the frozen `window.NeuralCriticStoryRouter` contract for slug lookup, clean story URLs, topic URLs, and canonical enforcement.
- `assets/supabase-config.js` loads Story Router before runtime hardening where routing applies. Studio and Subscriber Desk continue to skip Story Router while retaining their existing hardening pass.
- `assets/public-hardening.js` obtains legacy article identity from the shared router contract, with a clean-route fallback, and no longer treats arbitrary nested directory indexes as the homepage.
- `assets/supabase-client-config.js` owns `window.neuralCriticPrivateSupabase`; Newsroom consumers no longer construct competing clients.

No public HTML structure, CSS, navigation, content, route architecture, ranking, commerce behavior, schema/RLS policy, Edge Function, Auth setting, or benchmark feature was added or redesigned.

## Authorization and verification environment

No reader, editor, or admin test identity was created. The connected production project has no disposable development branch, and this workspace has no authorized verification credentials or server-side service-role credential. Creating users in production merely to raise a verification level would violate the fixture contract, so `manage_verification_identities.py plan` was the only identity action and made no network call or write.

Read-only live checks added useful but bounded evidence:

- A published-article control returned a row using the existing browser publishable key.
- Anonymous GETs to seven expected protected tables all returned HTTP 401.
- The audit fails if any protected table returns HTTP 200, even when empty, because empty state is not authorization proof. It also fails if an expected table is missing, the control fails, or the endpoint cannot be reached.
- Read-only live catalog inspection confirmed RLS enabled on 11 relevant tables and inspected owner/editor/admin policy expressions. This is structural policy evidence, not credentialed enforcement proof.
- The live Supabase security advisor reported one pre-existing warning: leaked-password protection is disabled. No production setting was changed. See <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.

## Regression protection added

### `scripts/test_protected_runtime.js`

A dependency-free Node VM/minimal-DOM harness executes the real runtime modules. It protects five contracts:

1. Legacy canonical, `og:url`, Article schema, and Breadcrumb schema use the clean story URL.
2. Games and Reviews retain directory-owned titles while the actual homepage still hardens.
3. Story Router exposes and enforces the canonical contract.
4. Bootstrap orders routing before metadata hardening while preserving private-page hardening.
5. Private Supabase client creation is singleton-owned and loaded before Newsroom consumers.

The suite failed `5/5` before the bounded fixes and passes `5/5` afterward.

### `scripts/audit_live_auth_boundaries.py`

This GET-only audit uses only the committed browser publishable configuration. It requires a successful public control and an authorization denial from seven private/per-user tables. It prints no response bodies and performs no mutation. It does not replace the reader/editor/admin positive and negative write matrix.

Both checks are watched, parse-checked where applicable, and executed by Publication health. The baseline audit now fails if that CI wiring disappears.

## Capability ledger updates

Eight existing rows received fresh owner/evidence/limitation annotations: `NC-GS-028`, `NC-GS-041`, `NC-GS-071`, `NC-GS-173`, `NC-GS-181`, `NC-GS-182`, `NC-GS-199`, and `NC-GS-200`. IDs, status counts, verification-level counts, and the six genuinely missing capabilities did not change. The CSV remains canonical and the Markdown view is generated from it.

## Verification evidence

Publication generation completed:

- runtime fallback: 53 published articles
- canonical story shells: 53
- topic hubs: 72
- game pages: 7
- writer hubs: 1
- metadata enrichment: 53/53 shells
- sitemap/RSS/robots generation: passed

The RSS builder's expected timestamp-only drift was inspected and removed from the branch diff.

Final checks:

- all 21 `scripts/audit_*.py` entry points exited `0`
- capability ledger: 200 rows, 0 errors, 0 warnings
- capability Markdown synchronization: passed with 200 rows
- live/fallback parity: 53 live rows, 53 fallback rows, 53 detail rows, 53 shells
- protected runtime suite: 5/5 passed
- live anonymous boundary: public control passed; all seven protected tables returned HTTP 401
- JavaScript parse checks: 90/90 files passed
- Python compile checks: 35/35 files passed
- workflow parse checks: 6/6 files passed
- identity fixture plan: passed with no network call or write
- `git diff --check`: passed

Known non-failing baseline warnings remain visible: three reviews lack tested-platform metadata, 23 populated story game keys have no Games Database record, and 23 older stories sit outside the intentional 30-item RSS cap.

## Files changed

- `.github/workflows/publication-health.yml` — watches, parse-checks, and runs the new protected gates; watches this report.
- `assets/story-router.js` — exposes the existing router as the single canonical contract.
- `assets/public-hardening.js` — consumes the clean canonical and isolates homepage metadata from nested directories.
- `assets/supabase-config.js` — enforces router-before-hardening order without dropping private-page hardening.
- `assets/supabase-client-config.js` — creates the single private Newsroom Supabase client.
- `assets/newsroom-dashboard.js` — consumes the private singleton.
- `assets/newsroom-guards.js` — consumes the private singleton.
- `scripts/test_protected_runtime.js` — deterministic regression coverage for the three reproduced defects and bootstrap boundary.
- `scripts/audit_live_auth_boundaries.py` — read-only live anonymous access gate.
- `scripts/audit_overhaul_baseline.py` — protects the new Publication health wiring.
- `docs/CAPABILITY_STATUS.csv` — canonical row-level Milestone 2 evidence annotations.
- `docs/CAPABILITY_STATUS.md` — regenerated human ledger view.
- `docs/OVERHAUL_BASELINE.md` — records the owner/order/singleton contracts and Milestone 2 boundary.
- `docs/VERIFICATION_EVIDENCE.md` — records deterministic, live read-only, blocked, and security-advisor evidence.
- `docs/VERIFICATION_ENVIRONMENT.md` — adds the live boundary commands and current fixture limitations.
- `docs/MILESTONE_2_REPORT.md` — durable completion record.

## Remaining limitations

- No exact-branch deployed browser pass was possible. The workspace has the Playwright package but no browser binary, and browser download attempts repeatedly timed out. Branch-specific console/network, responsive/mobile, light/dark, keyboard, and visual behavior remain unclaimed.
- No reader/editor/admin fixture environment was authorized. Sign-in/session/profile/avatar, community writes, Save/follows/Following feed, Studio, Newsroom, and Subscriber Desk still lack fresh V4/V5 positive/negative/reload evidence.
- No production-equivalent publish/provider journey was attempted.
- The full live RLS write/role matrix is still blocked; anonymous GET denials and policy inspection are not a substitute.
- Branch-specific GitHub Actions remain pending until the branch is pushed or opened for review.
- The Supabase leaked-password protection warning remains unresolved by design because it is an operational Auth change outside this branch's authority.

## Recommendation for Milestone 3

Use a bounded **Deployment Canary & Credentialed Authorization Proof** milestone before visual or feature work:

1. Push/open this branch for review and run Publication health on the exact commit.
2. Deploy an isolated preview or authorized Supabase development branch.
3. Run the exact-branch desktop/mobile/theme/console/network pass for both article routes, Games, Reviews, Studio, Newsroom, and Subscriber Desk.
4. Provision disposable reader/editor/admin fixtures only in that approved environment; execute the V4/V5 persistence and role-negative matrix, then clean up and independently verify deletion.
5. Let an authorized owner decide whether to enable leaked-password protection, with sign-up/sign-in/recovery regression coverage.

Do not implement the six missing benchmark capabilities during that milestone.
