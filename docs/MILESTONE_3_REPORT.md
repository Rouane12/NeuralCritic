# Neural Critic Overhaul — Milestone 3 report

Date: `2026-09-02`

Milestone 3 is evidence-only. It changes no public template, style, runtime module, data model, RLS policy, authentication setting, provider configuration, or benchmark feature. The branch remains unmerged.

## A. Exact branch and commit tested

| Item | Value |
|---|---|
| Branch | `overhaul/baseline-regression-safety` |
| Local pre-evidence commit | `8360776` |
| Exact browser/CI commit | `cfc8f993abbb2ea246c7b8182d4acfec6aea8ac5` |
| Exact Git tree | `bf173b15b5a59c2c1d9625fbd0e65849df222d00` |
| Review vehicle | Draft pull request `#54`; not merged |

The local and remote commits above have different commit metadata but the same Git tree. The immutable exact-commit browser canary used the remote commit. Evidence/documentation changes made after that canary are validated by the branch's final Publication Health check; a self-referential final commit SHA is deliberately not embedded in its own tree.

The remote `main` branch advanced after this overhaul branch was created. The draft pull request currently requires an audited reconciliation with current `main`; no automatic rebase or merge was attempted.

## B. CI and deployment evidence

- Publication Health pull-request run `#398` / workflow run `33664791942` executed against `cfc8f993abbb2ea246c7b8182d4acfec6aea8ac5` and succeeded. Job `100363752745` completed every builder, parse, protected-runtime, anonymous-boundary, commerce, publication, baseline, capability-ledger, parity, launch, reader-auth, Newsroom-source, discovery, popularity, games, reviews, newsletter, reliability, runtime, and domain step successfully.
- The shell `git push` path was blocked before network contact because the environment could not approve that network operation. This was not reported as a credential failure. The authorized GitHub repository connection was instead used to create the exact tree, branch, and draft pull request.
- The exact-commit canary was served from an immutable commit CDN path. This proves exact bytes, but it is not a production-equivalent hosting environment.
- Generated nested shells contain `<base href="/">`. On a commit-CDN subpath, `/games/`, `/reviews/`, generated game/topic/story shells, and their root-relative assets escape the commit prefix. Their static metadata could be inspected, but those routes could not hydrate. This is a canary-host limitation, not evidence that production routing is broken.
- No production route was changed and nothing was merged to `main`.

## C. Real-browser results

The browser was real Chrome at `1363 × 936`. The available browser controller did not expose viewport mutation, so no real mobile-width claim is made.

| Representative surface | Exact-commit result | Evidence boundary |
|---|---|---|
| Homepage | Fully hydrated; header/footer/feed rendered; `11/11` images loaded | Desktop, signed out |
| Search | Overlay opened by pointer and keyboard; query returned entity and story results | Desktop, signed out |
| `/games/` | Correct exact-shell metadata; hydration blocked by commit-CDN base-path behavior | Static shell only |
| `/reviews/` | Correct exact-shell metadata; hydration blocked by commit-CDN base-path behavior | Static shell only |
| Elden Ring game page | Correct exact-shell title/canonical/schema; hydration blocked by base path | Static shell only |
| News category | Fully hydrated; header/footer and `22/22` images loaded | Desktop, signed out |
| Grand Theft Auto franchise hub | Correct exact-shell metadata; hydration blocked by base path | Static shell only |
| Clean Elden Ring story | Correct static canonical/OG/schema/title; runtime hydration blocked by base path | Static shell only |
| `article.html?slug=elden-ring-review-monumental-open-world` | Fully hydrated representative review | Desktop, signed out |
| Editorial Studio | Full signed-out auth gate, private robots metadata | No authenticated entry |
| Newsroom | Full signed-out auth gate, private robots metadata | No authenticated entry |
| Subscriber Desk | Full signed-out admin-entry gate, private robots metadata | No authenticated entry |

On the hydrated representative article, the title, deck, byline, hero, body, Reading Map, review verdict and score, Related Coverage, Connected Coverage, recirculation, Game Graph links, community controls, sharing, save/follow controls, image credits, and footer rendered. Reading Map navigation resolved to the requested section. The review score completed its intended viewport-triggered animation to `10` after the score panel entered view.

The image viewer opened through pointer and keyboard, displayed the correct source, alt text, caption, credit, position, and closed with Escape. Theme changes worked through pointer and keyboard and survived reload in both light and dark states. Signed-out Article Like, Save, entity follow, author follow, Reply, comment Like, and comment Dislike reached the real sign-in gate. Copying the article and comment permalinks produced clean story URLs.

No duplicate script URLs or duplicate owner-module execution was observed on the fully hydrated routes. Representative full routes had no broken images or site-owned JavaScript exception. Browser-extension metadata messages were classified separately. The exact canary homepage also logged the expected popularity-service warning because the commit-CDN origin is not an allowed production origin. Root-relative failures on the static-only routes are the documented canary-host limitation.

The representative Elden Ring review correctly showed no commerce module. A read-only source check found no mapped product, active product, or currently eligible offer for that story, so this is an expected conditional state rather than a missing render.

## D. Canonical, title, and Supabase-client verification

### Canonical ownership

After all asynchronous legacy article scripts settled, the following values all resolved to the clean exact-commit story URL ending in `/stories/elden-ring-review-monumental-open-world/`:

- `link[rel=canonical]`
- `og:url`
- Review JSON-LD `url` and `mainEntityOfPage`
- final Breadcrumb JSON-LD item
- Share output

The address bar remained on the compatibility `article.html?slug=…` route, as intended. The clean shell's static values matched the same story identity, but its runtime could not settle on the subpath canary. `NC-GS-028` therefore remains 🟡 V3 rather than being promoted.

### Directory and route titles

Final hydrated titles were correct for the homepage, News category, and legacy article. Exact generated shells exposed correct, distinct titles for Games, Reviews, the game page, topic hub, and clean story. Because the Games and Reviews scripts could not hydrate on this canary host, the deterministic protected-runtime suite remains the post-script proof for those two title contracts; no stronger browser claim is made.

### Supabase client ownership

Studio, Newsroom, and Subscriber Desk each reached their signed-out gate with no Neural Critic site-origin multiple-GoTrue-client warning. The warning was not hidden or filtered. No authenticated editor/admin session was available, so post-login consumers remain unverified.

## E. Reader V4 results

No server-persisted reader journey received new V4 evidence. There was no approved disposable Supabase branch, service-role fixture authority, or non-personal reader credential. Creating production users merely to raise verification scores was deliberately avoided.

| Journey | Result |
|---|---|
| Account creation, email/password sign-in, persistent session, profile, avatar, sign-out | Blocked before mutation; no fixture identity |
| Article Like, Save, comment post/edit/delete, nested Reply, comment Like/Dislike | Signed-out gates verified where applicable; server write/re-read/reload/cleanup blocked |
| Game, series, franchise follows and Following feed | Signed-out game-follow gate verified; credentialed source/reload sequence blocked |
| Article/comment Copy permalink | Browser clipboard output verified; this is not a server-persistence claim |
| Theme choice | Exact-branch local preference survived reload in light and dark; existing V4 evidence strengthened |

Nested comment targeting was inspected through the real thread controls, but no authenticated nested write was attempted. It remains unproven at V4.

## F. Editor and admin V4/V5 results

Studio, Newsroom, and Subscriber Desk private metadata and signed-out gates were verified in the exact browser canary. No editor/admin identity or safe writable environment existed, so story-library access, disposable-draft save/reload, structured fields, Game Graph/source/media metadata, workflow assignment/status/priority/due-date/history, moderation, Subscriber Desk mutation, and publish/schedule/rollback were not attempted. No V4/V5 editorial capability was promoted.

## G. RLS positive and negative matrix

| Role | Actual server evidence | Result |
|---|---|---|
| Anonymous public read | Published-article control returned a live row | Pass |
| Anonymous protected read | `article_reactions`, `comment_reports`, `editor_profiles`, `editorial_workflow`, `newsletter_subscribers`, `reader_entity_follows`, and `reader_saved_stories` each returned HTTP `401` | Pass |
| Reader permitted writes/ownership | No approved reader fixture | Blocked |
| Reader privilege escalation | No approved reader fixture | Blocked |
| Editor allowed operations | No approved editor fixture | Blocked |
| Editor admin-only denial | No approved editor fixture | Blocked |
| Admin intended operations | No approved admin fixture | Blocked |

Live catalog inspection from Milestone 2 still shows RLS enabled on the 11 relevant tables and owner/role policy definitions. Policy text is structural evidence, not a substitute for the blocked role tests. No RLS, grants, JWT handling, or Auth setting was changed.

## H. Provider verification

No newsletter-delivery, provider-sync, commerce-provider, service-role, or synthetic subscriber credentials were available. Newsletter capture, provider synchronization, unsubscribe propagation, and cleanup were not attempted. Subscriber identifiers were not logged. These capabilities remain 🟡 at their prior levels.

## I. Capability status changes

Milestone 3 changes only rows supported by new exact-branch browser evidence:

| Capability | Before | After | Reason |
|---|---:|---:|---|
| `NC-GS-039` image captions/alt/credits | ✅ V2 | ✅ V3 | Representative exact article browser proof |
| `NC-GS-040` image viewer | 🟡 V2 | 🟡 V3 | Open/close/keyboard behavior proved; focus restoration defect keeps it partial |
| `NC-GS-191` desktop responsive layout | ✅ V3 | 🟡 V3 | Reproducible horizontal overflow at a common desktop width |
| `NC-GS-196` keyboard/focus interaction | 🟡 V2 | 🟡 V3 | Representative browser behavior proved, with focus defects retained |
| `NC-GS-197` semantic/ARIA states | 🟡 V2 | 🟡 V3 | Representative dialog, pressed, label, and status transitions observed; no full assistive-technology audit |

Final status counts: `125 ✅ / 69 🟡 / 6 ❌ / 0 🚫`.

Final verification counts: `V0=0 / V1=6 / V2=109 / V3=81 / V4=3 / V5=1`.

The six missing capabilities remain unchanged and out of scope: video programming, structured comparison/buying-guide format, recently viewed, per-user recommendations beyond follows, Article Dislike, and newsletter content preferences.

## J. Newly discovered bugs

| ID | Finding | Regression origin |
|---|---|---|
| `BUG-M3-01` | At `1363 × 936`, the representative article has horizontal overflow: document width `1534`, viewport `1363`; `.work-article-sidebar` reaches the overflow edge. Reproduced on current production. | Pre-existing; not introduced by Milestone 3 |
| `BUG-M3-02` | The exact branch's signed-out author control initially says `FOLLOWING` even though activating it opens sign-in. Current production says `FOLLOW`, indicating branch drift that must be reconciled. | Pre-existing on this branch; no Milestone 3 product edit |
| `BUG-M3-03` | Closing the image viewer with Escape leaves focus on `BODY` instead of returning it to the invoking image. Reproduced on current production; the owner has no focus-restoration step. | Pre-existing; not introduced by Milestone 3 |
| `BUG-M3-04` | Closing the exact-canary search overlay with Escape leaves focus on `BODY` rather than the search trigger. | Existing exact-branch behavior; production parity not established |

The viewport-triggered review score animation is not a bug: it completed normally after the score panel entered the viewport. The commit-CDN base-path limitation is also not classified as a product defect.

## K. Security recommendation

The live Supabase security advisor still reports Auth leaked-password protection disabled. Supabase's current guidance says this control uses the Have I Been Pwned Pwned Passwords data to reject compromised passwords and is available on eligible paid plans. Enabling it may affect new passwords, password changes/recovery, and the sign-in experience for an existing weak password through a weak-password warning/error path.

Recommendation: the product owner should authorize a controlled enablement window only after adding regression coverage for:

1. signup rejection for a known-compromised password and acceptance of a strong fixture password;
2. existing-user email/password sign-in and any weak-password response UX;
3. recovery and password-update flows;
4. session refresh/persistence across Reader, Studio, and Newsroom;
5. accessible error copy, support guidance, monitoring, and rollback ownership.

Do not change this setting merely to remove an advisor warning. Milestone 3 leaves it unchanged.

## L. Files changed

| File | Reason |
|---|---|
| `docs/MILESTONE_3_REPORT.md` | Durable A–O evidence record |
| `docs/VERIFICATION_EVIDENCE.md` | Exact-commit CI/canary/auth/RLS/provider/security evidence and defects |
| `docs/VERIFICATION_ENVIRONMENT.md` | Current branch, canary, identity, provider, and browser limitations |
| `docs/OVERHAUL_BASELINE.md` | Milestone 3 evidence-only boundary and next-session safeguards |
| `docs/CAPABILITY_STATUS.csv` | Five classification changes plus related exact-browser/blocker evidence annotations |
| `docs/CAPABILITY_STATUS.md` | Deterministically rendered view of the canonical CSV |
| `.github/workflows/publication-health.yml` | Ensure the Milestone 3 contract triggers Publication Health |
| `scripts/audit_overhaul_baseline.py` | Require the Milestone 3 report and CI watch path |

No public/runtime/Supabase/provider file is changed.

## M. Complete regression results

The final branch validation includes all publication builders, all `scripts/audit_*.py` entry points, the protected-runtime `5/5` suite, live/fallback parity, live anonymous security boundary, capability audit, ledger renderer check, all JavaScript parse checks, all Python compilation checks, all workflow YAML parse checks, client-secret scanning, and `git diff --check`. Exact results are also recorded in `docs/VERIFICATION_EVIDENCE.md`.

The builder's time-dependent RSS `lastBuildDate` is inspected separately and is not accepted as meaningful product drift. The final committed tree contains no generated public-artifact change.

## N. Remaining blockers

- No approved non-production Supabase branch or production-equivalent writable environment.
- No dedicated non-personal reader/editor/admin credentials or server-side fixture authority.
- No newsletter/provider/synthetic-subscriber authority.
- No mobile viewport control in the available browser.
- The immutable subpath canary cannot fully hydrate root-based generated directory/entity/story shells.
- Clean-route post-hydration canonical behavior therefore lacks exact-branch browser proof, although static and deterministic contracts pass.
- The overhaul branch has drifted behind current remote `main` and requires reviewed reconciliation before further work.
- Publishing/scheduling and provider operations remain below V5 because they were not safely exercised.

## O. Recommendation for Milestone 4

Make Milestone 4 a **baseline reconciliation and authorized verification-lane milestone**, not a visible redesign:

1. review and reconcile current `main` into the overhaul branch without discarding either side's mature owners;
2. provide an exact-branch preview at a root path so generated shells can hydrate normally;
3. provide an approved disposable Supabase branch plus scoped reader/editor/admin fixtures;
4. run the documented V4 source-re-read/reload/cleanup matrix and role-negative matrix;
5. provide synthetic newsletter/provider authority only if those journeys are meant to reach V4/V5;
6. resolve or explicitly accept the four browser defects before treating desktop/accessibility as a stable redesign baseline.

Do not implement the six missing benchmark capabilities or begin the GameSpot-inspired visual overhaul until that verification lane is reviewed and accepted.
