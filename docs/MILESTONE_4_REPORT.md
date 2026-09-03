# Neural Critic Overhaul — Milestone 4 Report

Date: 2026-09-02
Branch: `overhaul/baseline-regression-safety`
Reconciled `main`: `c54d50161b901b20437f981ed9bf4a9707e0f846`
Resumed browser canary commit: `19f305334e8f4a2fbd8e428bc636d6963c71d234`
Original exact product/CI commit: `5df66dcee973e4c9427d6be110ac590fc63a9993`
Exact product tree: `62de17623eb8e099c63686dca76017eb78fecfbf`

Milestone 4 reconciles the overhaul branch with current `main` and fixes only the four reader-baseline defects recorded by Milestone 3. It does not redesign a surface, implement a missing benchmark capability, change a Supabase policy, or merge into `main`.

## A. `main` changes reconciled

The branch diverged from `main` at `ddb6aa88bdd76756c85beb06627fc95dac261023`. Five later `main` commits were inspected before final reconciliation:

- `236bab3` — Refresh Neural Critic canonical publication pages
- `94ad28c` — Refresh Neural Critic canonical publication pages
- `89edd3d` — Refresh Neural Critic canonical publication pages
- `a175407` — Refresh Neural Critic canonical publication pages
- `c54d501` — Refresh Neural Critic canonical publication pages

Their cumulative content change is limited to `feed.xml`: the generated RSS `lastBuildDate` advanced from `Wed, 02 Sep 2026 01:34:28 +0000` to `Wed, 02 Sep 2026 20:07:20 +0000`. No protected runtime, canonical owner, publishing implementation, Game Graph, discovery/coverage/recirculation/popularity module, reader/community/follow owner, commerce module, analytics module, or Supabase boundary changed. None superseded a Milestone 2 or 3 fix.

The overhaul branch records `c54d501` as merge ancestry. Production routing was not altered.

## B. Conflicts and resolutions

The original `main` merge completed without a content conflict. On resume, the clean local checkout was still at a parallel Milestone 2 history, so merging the completed remote branch surfaced seven textual/add-add conflicts in the workflow, ledger documents, verification documents, and baseline audit. Each side was compared: the remote versions retained the Milestone 2 contract and added the later Milestone 3/4 evidence, 27 evidence-level ledger revisions, report wiring, and reader test. Those verified later versions resolved the conflicts while the local history remained a merge parent. The subsequent `c54d501` merge was clean and changed only `feed.xml`. No product implementation conflict occurred, mature owners were preserved, and no parallel system was created.

Publication builders regenerated timestamp-bearing feed/sitemap artifacts during validation. Those incidental outputs were restored to the reconciled branch versions, and `git diff --exit-code -- feed.xml sitemap.xml` confirmed no generated-publication drift.

## C. Signed-out author follow (`BUG-M3-02`)

The defect was reproduced after `main` reconciliation, proving that the feed-only upstream change did not fix it. The signed-out article control rendered `FOLLOWING` before authenticated state was known.

The existing owners received the smallest correction:

- `assets/article-extras.js` initializes article/author follow controls as neutral `FOLLOW` controls.
- `assets/community-core.js` establishes `FOLLOW`, `aria-pressed=false`, and no active/followed styling before its signed-out early return. Authenticated state still comes from the existing server-backed owner.

On the exact branch canary, a signed-out session shows `SIGN IN` and the author control settles as `FOLLOW`, unpressed, without followed styling. Signed-in follow persistence was not reclassified because no approved identity exists.

## D. Article horizontal overflow (`BUG-M3-01`)

At `1363 × 936`, the pre-fix document was `1534px` wide. The root cause was the interaction between the site's `1.21` desktop zoom and an article grid that required fixed `132px + 732px + 376px` tracks. The effective CSS layout viewport could not contain that `1240px` grid.

`assets/article-sidebar-interactive.css` retains the three-column Reading Map/article/sidebar architecture but lets the content and sidebar tracks contract safely with `minmax(...)`. It does not hide page overflow or remove content.

At the reproduced viewport, standard, review, guide, and ranked-list runtimes each report `documentElement.scrollWidth=1348` against a `1363px` browser viewport. The settled tracks are approximately `132px 550px 376px`, and the sidebar remains visible. Light and dark article states remain overflow-free.

## E. Image-viewer focus restoration (`BUG-M3-03`)

`assets/image-viewer.js` retains the connected image/control that invoked the existing viewer and synchronously restores focus through its shared Escape, Close, and backdrop close path. Pointer and keyboard opening, Escape, image navigation, image position, alt, caption, and credit remain intact.

Browser verification also exposed the existing viewer's row content extending beyond its fixed viewport under desktop scaling, placing Close off-screen. `assets/image-viewer.css` constrains the existing top, stage, and footer rows to the viewport without creating another viewer. Pointer Close and Escape return focus to the invoking image, and Close stays inside the viewport.

## F. Search-overlay focus restoration (`BUG-M3-04`)

`assets/public-accessibility.js` keeps the existing search behavior and overlay. Focus restoration resolves the connected/current header search trigger and runs in the immediate post-close task instead of waiting on a throttled animation frame.

Pointer-opened and keyboard-opened browser paths both focused the query field, returned nine links for `elden ring`, closed on Escape, and returned focus to the search trigger in the immediate check. Mobile-navigation interaction was not claimed because viewport mutation was unavailable.

## G. Responsive and browser evidence

Real Chrome re-exercised immutable branch commit `19f305334e8f4a2fbd8e428bc636d6963c71d234` at the available `1363 × 936` viewport. The later `main` merge changes only the RSS build timestamp, so the tested reader assets are identical in the reconciled working tree.

| Surface | Result |
|---|---|
| Standard, review, guide, ranked-list articles | Hydrated; no page-level overflow; Reading Map and sidebar retained |
| Header/navigation, article, community, related/connected/recirculation, Game Graph, footer | Present and usable in the representative desktop pass |
| Light/dark | Both checked on an article; neither introduced overflow |
| Image viewer | Pointer and keyboard open, navigation, caption/alt/credit, Close and Escape, opener focus restoration pass |
| Search overlay | Pointer and keyboard open, query/results, Escape, trigger focus restoration pass |
| Signed-out author follow | Neutral `FOLLOW`, `aria-pressed=false`, no active/followed styling |
| Console/network | No site-owned exception or newly failed site resource; browser-extension metadata errors were external; the existing canary audience-signals fallback warning remained |

The available browser cannot mutate its viewport. Narrow/mobile, tablet/intermediate, alternate desktop breakpoints, and mobile-navigation interaction therefore remain unverified; source media queries are not counted as browser proof.

## H. Capability ledger changes

Only five genuinely affected rows changed:

| ID | Result |
|---|---|
| `NC-GS-040` Image viewer | Promoted from 🟡 V3 to ✅ V3 after the complete representative browser journey passed |
| `NC-GS-069` Author follows | Remains 🟡 V3; signed-out state fixed, signed-in persistence still unverified |
| `NC-GS-191` Desktop responsive layout | Remains 🟡 V3; reproduced width fixed across four formats, other widths unavailable |
| `NC-GS-196` Keyboard/focus interaction | Remains 🟡 V3; two exact defects pass, no exhaustive accessibility/mobile pass |
| `NC-GS-200` Regression/publication health | Remains ✅ V2; reader-baseline contracts are enforced in exact-branch CI |

Final counts are `126 ✅ / 68 🟡 / 6 ❌ / 0 🚫`. Verification levels remain `V0 0 / V1 6 / V2 109 / V3 81 / V4 3 / V5 1`. The canonical CSV contains exactly 200 rows with IDs `NC-GS-001` through `NC-GS-200`. The six missing capabilities are untouched.

## I. Complete regression results

### Exact-branch CI

GitHub Actions Publication Health run `#403` (`33676784897`) succeeded against `5df66dcee973e4c9427d6be110ac590fc63a9993`. This exact product commit includes all four reader fixes. Runs `#404` (`33679169624`) and `#405` (`33679402981`) also succeeded against the completed documentation commits through `19f305334e8f4a2fbd8e428bc636d6963c71d234`; every reported job step completed successfully.

### Local deterministic checks

- Capability ledger audit after the final `main` reconciliation: pass; 200 contiguous rows.
- Ledger renderer check after the final `main` reconciliation: pass.
- Protected runtime: `5/5` pass.
- Reader baseline: `4/4` pass.
- Live/fallback/detail/shell parity: `53/53/53/53`, zero errors.
- All eight publication generation commands pass: `53` fallbacks, `53` story shells, `72` topic hubs, `7` game pages, `1` author hub, `53/53` enriched stories, plus robots and sitemap/RSS.
- All repository `scripts/audit_*.py` checks other than the separately described final local live rerun pass. This includes capability, commerce, content parity, discovery, domain readiness, games database/directory, launch, news sources, newsletter acquisition/delivery, overhaul baseline, popularity, publication v1/v2, publication reliability, reader auth, review intelligence, runtime consistency, and social preview.
- JavaScript parsing: `91` files pass.
- Python compilation: `35` files pass.
- Workflow YAML safe-load: `6` files pass.
- `git diff --check`: pass.
- Generated public artifacts: no unintended drift.

Expected existing warnings remain: three reviews lack tested-platform metadata, 23 referenced game keys lack database records, and 23 older stories are outside the newest-30 RSS window. They were not repaired.

The live anonymous-boundary audit passed during preflight and exact-commit Publication Health. A final local rerun could not obtain workspace network approval and is not claimed as a second local success. No RLS/Auth configuration changed.

## J. Files changed

| File | Reason |
|---|---|
| `.github/workflows/publication-health.yml` | Watch, parse-check, and execute the reader-baseline suite; watch this report |
| `assets/article-extras.js` | Neutral initial follow label/state |
| `assets/article-sidebar-interactive.css` | Let existing desktop article tracks contract without hiding overflow |
| `assets/community-core.js` | Deterministic signed-out follow state before the existing auth return |
| `assets/image-viewer.js` | Retain and restore the existing viewer opener |
| `assets/image-viewer.css` | Keep scaled existing viewer rows and Close within the viewport |
| `assets/public-accessibility.js` | Promptly restore focus to the current search trigger |
| `scripts/test_reader_baseline.js` | Four deterministic contracts for the repaired regressions |
| `docs/CAPABILITY_STATUS.csv` | Update only five affected evidence records |
| `docs/CAPABILITY_STATUS.md` | Rendered ledger view from the canonical CSV |
| `docs/VERIFICATION_EVIDENCE.md` | Durable reconciliation, browser, CI, and defect evidence |
| `docs/OVERHAUL_BASELINE.md` | Record the bounded M4 contract and viewport limitation |
| `docs/MILESTONE_4_REPORT.md` | Durable completion report |

No generated story, sitemap, feed, database, migration, or public routing artifact is intentionally changed.

## K. Remaining issues and blockers

- Real viewport mutation was unavailable, so mobile, tablet, wide desktop, and breakpoint transitions remain unproven.
- No approved reader/editor/admin identity or isolated Supabase environment exists; signed-in follow persistence and broader V4/V5 flows remain blocked.
- The final local live-boundary rerun was blocked by workspace network approval; exact-branch CI passed the same live audit.
- No full screen-reader/accessibility-tree audit was performed.
- The existing canary audience-signals fallback warning remains; no console error was suppressed.
- The existing capability gaps and operational warnings remain out of scope, including all six ❌ rows.

## L. Recommendation for Milestone 5

Begin visible improvements with one bounded reader-journey slice: homepage and global-navigation information hierarchy, including discovery entry points and explicit responsive acceptance criteria. Preserve the existing discovery, popularity, search, Game Graph, canonical-story, analytics, and publication owners. Define intended reader paths and regression gates first, then change presentation around those owners. Keep article-runtime and authenticated-persistence work in separate, explicitly authorized slices.

Do not start Milestone 5 automatically.
