# Neural Critic verification evidence registry

This registry gives the capability ledger stable, non-secret evidence IDs. Evidence is dated `2026-09-02` unless stated otherwise. Milestone 1 browser observations were made against the then-deployed public site. Milestone 2 added deterministic branch and live read-only production evidence. Milestone 3 adds an immutable exact-commit canary, exact-commit GitHub Actions evidence, and a conservative record of every credentialed path that remained blocked.

## Evidence handling rules

- An evidence ID proves only the scope written below; it must not be generalized into an authenticated, persisted, provider, or privileged success.
- Public runtime observations never establish that a write survived reload.
- Source code, a control, a table name, or an optimistic state is not persistence proof.
- No passwords, access tokens, comment IDs, private profile data, or service-role values are recorded here.
- Known failures remain evidence. They are not hidden, suppressed, or converted into successful classifications.

## Registry

### E-SRC-REPO

Repository-wide source inventory using `rg --files`, targeted `rg` owner/API/table searches, HTML/script load-order inspection, builders, audits, migrations, Edge Functions, workflows, generated JSON, sitemap, RSS, and canonical shells. This establishes V1 ownership and documented negative searches; it does not prove runtime success.

### E-M0-BASELINE

Milestone 0 architecture map and regression contract in `docs/OVERHAUL_BASELINE.md`, commit `f6cbab14d1315fab80c9916d475aba0ad02055d2`. It identifies protected systems, public/private boundaries, dependencies, and the full regression matrix.

### E-BUILD-PUBLICATION

The publication builders were run from the branch using the production configuration: runtime fallback, robots, sitemap/feed, story shells, topic pages, game pages, author pages, and metadata enrichment. Generated-file cleanliness and exact results are reported in the final validation section of this document.

### E-AUDIT-PUBLIC

The complete pre-existing Milestone 0 audit suite plus the new ledger and parity audits were run on the final branch state. Exact commands and exit results are recorded under “Final branch validation.”

### E-PARITY-LIVE

Read-only live comparison through the production fallback mapper: `53` published Supabase rows, `53` fallback index rows, identical ordered slug sets, and exact row equality. All `53` per-story JSON files equal their corresponding index rows, and all `53` canonical story shells exist. Reproducible with `python scripts/audit_content_parity.py`.

### E-CANONICAL-STATIC

Deterministic shell audit verifies every `/stories/<slug>/` page has its clean self-canonical, matching `og:url`, static slug marker, generated marker, detail JSON, and required runtime assets. Legacy query-route support remains separately owned by the shared article runtime.

### E-CANONICAL-BROWSER

Desktop public browser comparison of the same GTA VI story on `/stories/<slug>/` and `/article.html?slug=<slug>`. The clean shell rendered title/deck/byline/hero/body/Reading Map/community/discovery/share controls and retained clean canonical and `og:url`. The legacy route rendered the same article but finished with the query URL in canonical and `og:url`; this is verified pre-existing bug `BUG-M1-01`.

### E-BROWSER-PUBLIC

Signed-out desktop browser pass on `/`, Reviews, Guides, `/reviews/`, search, `/games/`, an Elden Ring game page, and a Grand Theft Auto franchise hub. Header/footer/account surfaces rendered, public data loaded, internal story links appeared, and no failed images were observed in the representative pass. `/games/` and `/reviews/` exposed pre-existing title bug `BUG-M1-02`.

### E-BROWSER-ARTICLE

Representative GTA VI story and Elden Ring review rendered real title, deck, byline, hero, body, Reading Map, related/connected coverage, recirculation, article Like, Save, Share, entity follow where mapped, and Reader Thread surfaces. Share copied the clean story URL. Commerce stayed absent on an ineligible story, which is the expected conditional state.

### E-BROWSER-SEARCH

`/search.html?q=elden%20ring` rendered a query-specific title, topics/people, and `14` story links in the observed public dataset. This proves a signed-out desktop result journey, not every ranking or keyboard case.

### E-BROWSER-GAMES

The game directory rendered `7 GAMES`; game search for “Elden” reduced the result to `1 GAME`; platform, genre, year, and release-state controls were present. The Upcoming state rendered `0 GAMES`, documenting sparse mapped game data rather than a missing control.

### E-BROWSER-THREAD

The Elden Ring review loaded one live public comment and visible Like, Dislike, Reply, Copy, and Report controls. Copy produced the matching canonical comment permalink. Like and Reply opened the real signed-out auth gate. No authenticated reaction/reply write was attempted.

### E-BROWSER-SIGNED-OUT

Signed-out article Like and Reply actions opened the real reader sign-in modal with email/password fields. No credential was entered. Save and follow implementation ownership was confirmed at source and controls rendered, but their signed-out gate timing was not strong enough for a separate journey claim.

### E-BROWSER-THEME

Desktop browser theme sequence: dark → click Light → light → reload → still light → click restore → dark. This is V4 persistence evidence for the local theme preference only.

### E-BROWSER-PRIVATE

Signed-out desktop browser pass on `studio.html`, `newsroom.html`, and `subscribers.html`. Each had `noindex,nofollow,noarchive,nosnippet`; Studio and Newsroom showed email/password gates, and Subscriber Desk directed the user to an approved-editor sign-in. This does not prove successful editor/admin authorization or writes.

### E-BROWSER-CONSOLE

Representative Milestone 1 console review found browser-extension metadata errors outside site origin and a site-origin Supabase warning about multiple GoTrue clients on private tooling pages. No site-origin JavaScript exception was seen during the representative public route pass. The GoTrue warning is `BUG-M1-03`; it remained unfixed on the Milestone 1 state observed by this evidence ID.

### E-GHA-LIVE

Milestone 0 recorded then-current `main` workflow health: Publication health run `#394` success, Refresh publication `#240` success, Pages `#937` success, commerce refresh `#17` success; Pages `#936` was cancelled because superseded. This is historical `main` evidence; exact branch evidence is `E-CI-EXACT-M3`.

### E-SUPABASE-STRUCTURE

Source inspection of Supabase clients, RLS migrations available in-repository, Edge Functions, Storage usage, table/RPC calls, role gates, and public/live reads. Current Supabase documentation was checked for server-only admin user creation, session behavior, and service-role handling. Structural evidence does not substitute for live RLS negative tests.

### E-IDENTITY-PLAN

`python scripts/manage_verification_identities.py plan` succeeds without network or writes. The guarded tool requires three non-personal `nc-verify` addresses, 16+ character secrets via environment only, the configured project ref, an explicit creation phrase, a server-only service-role environment variable, and a gitignored ID-only manifest. No identity was provisioned because those operator credentials were unavailable.

### E-AUTH-BLOCKED

No non-personal reader credential was available. Sign-in, signup, recovery, OAuth callback, persistent auth session, profile save, avatar upload, sign-out, Save persistence, article Like persistence, comments, replies, comment votes, entity follows, and Following feed could not receive V4 evidence.

### E-ADMIN-BLOCKED

No approved test editor/admin identity or server-side service-role credential was available. Editorial Studio, Newsroom, Subscriber Desk mutations, moderation, privileged RLS paths, publishing from the browser, and role-negative paths could not receive V4/V5 evidence.

### E-PROVIDER-BLOCKED

No newsletter-delivery or commerce-provider test credential/environment was available. Provider ingestion, outbound delivery, unsubscribe propagation, and provider failure/authorization paths remain structurally evidenced only.

### E-MOBILE-BLOCKED

The connected browser exposed no supported viewport mutation capability, so this pass did not claim real mobile-device behavior. Static responsive CSS and existing responsive audits remain V2 evidence only.

### E-NEG-VIDEO

Repository-wide search across public templates, assets, article data, builders, Studio fields, navigation, and audits found media/image support but no owned video programming hub/module/playlist journey. Embedded source references inside article prose do not constitute a video product surface.

### E-NEG-COMPARISON

Repository-wide article-format, Studio, runtime, data, route, and audit search found standard, ranked-list, game-guide, and review formats but no structured comparison/buying-guide format owner.

### E-NEG-HISTORY

Repository-wide account, personalization, storage, analytics, data, and migration search found saved stories and following feeds but no reader-facing recently viewed/history capability.

### E-NEG-PERSONALIZATION

Repository-wide discovery, popularity, account, follow, saved, data, and migration search found contextual discovery and followed-entity feeds but no per-user recommendation model or feed beyond explicit follows/saves.

### E-NEG-ARTICLE-DISLIKE

Repository-wide article controls, reaction handlers, table calls, migrations, and audits found article Like and comment Like/Dislike, but no article-level Dislike control/handler. Comment dislike is a different capability.

### E-NEG-NEWSLETTER-PREFERENCES

Repository-wide newsletter forms, Edge Function, Subscriber Desk, schema references, docs, and audits found email/source/status capture and delivery administration but no reader selection among news/deals/both or comparable newsletter-content preferences.

### E-SYNTAX

Python compile checks cover all scripts, and Node parse checks cover all JavaScript files. Workflow YAML is parsed as data. Exact results are recorded under final validation.

### E-DIFF-REVIEW

Final manual diff review confirms that Milestone 1 changes documentation, audits, workflow wiring, and guarded operator tooling only. No public HTML, CSS, public runtime behavior, database migration, RLS policy, product feature, or generated story content is intentionally redesigned or repaired.

### E-PROTECTED-RUNTIME-M2

`node scripts/test_protected_runtime.js` executes the real branch copies of `story-router.js`, `public-hardening.js`, `supabase-config.js`, `supabase-client-config.js`, `newsroom-dashboard.js`, and `newsroom-guards.js` in a dependency-free minimal DOM/VM harness. Before the bounded fixes, all five contracts failed and reproduced `BUG-M1-01`, `BUG-M1-02`, and `BUG-M1-03`. After the fixes, all five pass: the legacy route uses a clean story canonical across canonical/OG/schema/breadcrumb metadata; `/games/` and `/reviews/` retain their own titles while the real homepage still hardens; Story Router owns and re-enforces canonical identity; bootstrap orders the router before hardening; and Newsroom consumers reuse one private Supabase client. This is deterministic branch integration evidence, not post-deployment browser evidence.

### E-LIVE-AUTH-BOUNDARY-M2

`python scripts/audit_live_auth_boundaries.py` performs GET-only requests with the repository's browser publishable key. A public published-article control returned a row, proving the data endpoint was reachable. Anonymous reads of `article_reactions`, `comment_reports`, `editor_profiles`, `editorial_workflow`, `newsletter_subscribers`, `reader_entity_follows`, and `reader_saved_stories` each returned HTTP 401. The audit requires an authorization denial; it rejects even an empty HTTP 200 because empty state alone is not authorization proof. It also rejects protected rows, missing expected tables, network failures, and other statuses. It makes no write and proves no authenticated role path.

### E-SUPABASE-POLICY-M2

Read-only live catalog inspection confirmed RLS enabled on 11 relevant tables: `article_comments`, `article_reactions`, `articles`, `comment_reactions`, `comment_reports`, `editor_profiles`, `editorial_workflow`, `newsletter_subscribers`, `reader_entity_follows`, `reader_profiles`, and `reader_saved_stories`. Policy definitions were inspected for published-article visibility, owner checks using `auth.uid()`, editor/admin role predicates, and admin-only subscriber access. Policy counts ranged from two to five per table. This is structural deployed-policy evidence; without reader/editor/admin fixtures it does not prove positive or negative authenticated enforcement.

### E-AUTH-FIXTURE-BLOCKED-M2

The connected production project exposes no disposable development branch, and no verification reader/editor/admin credentials or server-side service-role credential are available in the workspace. `python scripts/manage_verification_identities.py plan` passes without a network call or write. No account was provisioned in production, no RLS/auth setting was weakened, and no credentialed V4/V5 claim was made.

### E-SUPABASE-ADVISOR-M2

The live Supabase security advisor returned one pre-existing warning: Auth leaked-password protection is disabled. No setting was changed in this milestone. Remediation requires an authorized operational decision and is documented by Supabase at <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.

### E-BROWSER-BLOCKED-M2

The workspace has the Playwright Node package but no usable browser binary. Browser installation attempts repeatedly timed out against the available download endpoints. Therefore the exact branch could not receive a real browser console/network, mobile viewport, light/dark, or authenticated interaction pass. The deterministic runtime harness and live read-only API checks are reported at their actual levels rather than presented as browser proof.

### E-CI-EXACT-M3

The branch tree `bf173b15b5a59c2c1d9625fbd0e65849df222d00` was published as commit `cfc8f993abbb2ea246c7b8182d4acfec6aea8ac5` on `overhaul/baseline-regression-safety`. Publication Health pull-request run `#398` (`33664791942`), job `100363752745`, completed successfully on that exact commit. Draft pull request `#54` remains open and unmerged. The shell push path was blocked before network contact; it was not misreported as a credential failure.

### E-CANARY-M3

A real Chrome session loaded the immutable exact-commit tree through a commit CDN. Homepage, News category, search, the legacy article runtime, Studio, Newsroom, and Subscriber Desk hydrated. Games, Reviews, generated game/topic pages, and the clean story shell exposed correct static metadata but could not hydrate because `<base href="/">` sends root-relative resources outside the CDN's commit subpath. That hosting limitation is recorded rather than promoted into deployment-equivalent proof. The available browser controller exposed only a `1363 × 936` desktop viewport, so mobile remains unverified.

### E-CANONICAL-BROWSER-M3

After the exact-branch legacy Elden Ring review settled, canonical link, `og:url`, Review JSON-LD `url` and `mainEntityOfPage`, final Breadcrumb item, and Share output all resolved to the clean `/stories/elden-ring-review-monumental-open-world/` identity. The compatibility query route remained in the address bar. The clean shell's static metadata matched, but its runtime could not hydrate on the subpath canary; this evidence therefore does not promote canonical parity beyond V3.

### E-TITLE-BROWSER-M3

The exact-branch homepage, News category, and legacy article retained correct final hydrated titles. Games, Reviews, game, topic, and clean-story shells exposed correct distinct static titles. Because their root-based runtime assets could not hydrate on the canary host, post-script Games/Reviews title isolation remains proven by `E-PROTECTED-RUNTIME-M2`, not by a fully settled browser route.

### E-ARTICLE-BROWSER-M3

The hydrated exact-branch legacy review rendered title, deck, byline, hero, body, Reading Map, review verdict/score, image metadata, Related Coverage, Connected Coverage, recirculation, Game Graph links, community/share/save/follow controls, and footer. Reading Map navigation worked. The score completed its viewport-triggered animation to `10`. The image viewer opened by pointer and keyboard, displayed matching alt/caption/credit, and closed with Escape. No duplicate script URL or broken article image was observed. The page did expose `BUG-M3-01` horizontal overflow and `BUG-M3-03` focus loss.

### E-INTERACTION-M3

Exact-branch pointer and keyboard checks opened search and the image viewer, navigated Reading Map, copied clean article/comment permalinks, and toggled theme. Light and dark choices each survived reload. Signed-out Article Like, Save, game follow, author follow, Reply, comment Like, and comment Dislike reached the real auth gate without creating a write. Search and viewer Escape behavior exposed focus-restoration defects. Clipboard and local theme evidence do not establish server persistence.

### E-PRIVATE-CONSOLE-M3

Studio, Newsroom, and Subscriber Desk reached their exact-branch signed-out private gates with no Neural Critic site-origin multiple-GoTrue-client warning. No warning was suppressed. Browser-extension metadata noise was classified separately. No editor/admin login existed, so post-login consumers remain unverified.

### E-AUTH-FIXTURE-BLOCKED-M3

The connected Supabase project still exposes no disposable branch, and the workspace has no `NC_VERIFY_*` reader/editor/admin credentials or service-role value. `python scripts/manage_verification_identities.py plan` succeeded without network or writes. No production user was created, no credential was committed or logged, and no authenticated V4/V5 capability was promoted.

### E-RLS-M3

The Milestone 3 preflight and final regression repeated the read-only live boundary audit: the published-article control succeeded, and all seven protected-table anonymous reads returned HTTP `401`. Reader/editor/admin positive and negative server paths remained blocked by missing approved fixtures. Existing live policy inspection is structural evidence only; no RLS or Auth configuration changed.

### E-PROVIDER-BLOCKED-M3

No newsletter, provider-sync, commerce-provider, service-role, or synthetic-subscriber authority was present. No provider mutation, delivery, unsubscribe, or cleanup was attempted, and no subscriber address was logged.

### E-SUPABASE-ADVISOR-M3

The live security advisor still reports `auth_leaked_password_protection` disabled. Supabase's current password-security guidance and current Auth changelog were reviewed. The setting was not changed. Product-owner recommendation and required signup/sign-in/recovery/session regression coverage are recorded in `docs/MILESTONE_3_REPORT.md`.

### E-MAIN-RECONCILIATION-M4

`origin/main` was fetched at `a175407aced7e9207c44cdc3f5cadcbc6b89e538` from merge base `ddb6aa88bdd76756c85beb06627fc95dac261023`. Its four post-divergence commits cumulatively changed only `feed.xml`, advancing the generated RSS `lastBuildDate` from `Wed, 02 Sep 2026 01:34:28 +0000` to `Wed, 02 Sep 2026 17:42:21 +0000`. The local merge completed without a content conflict; the published branch records `main` as merge ancestry and preserves the same reconciled tree. No protected runtime owner or Milestone 2/3 fix was superseded.

### E-READER-BASELINE-M4

`node scripts/test_reader_baseline.js` provides four deterministic source-contract checks: the desktop article grid keeps shrinkable tracks without hiding overflow; every image-viewer close path retains and restores a connected opener while scaled viewer rows remain viewport-bound; search restoration uses the current trigger without relying on a throttled animation frame; and the community owner establishes a neutral signed-out author-follow state before returning. Publication Health watches, parse-checks, and runs this suite. All `4/4` checks pass.

### E-CI-EXACT-M4

GitHub Actions Publication Health run `#403` (`33676784897`) completed successfully against exact merge-ancestry branch commit `5df66dcee973e4c9427d6be110ac590fc63a9993`, whose product tree is `62de17623eb8e099c63686dca76017eb78fecfbf`. The workflow includes all publication builders, JavaScript parsing, the `5/5` protected-runtime suite, the new `4/4` reader-baseline suite, capability-ledger validation, live/static content parity, and the live anonymous-auth boundary audit. This is exact-branch integration evidence, not a substitute for credentialed V4 testing or unavailable viewport sizes.

### E-READER-BROWSER-M4

Real Chrome exercised the immutable product tree `62de17623eb8e099c63686dca76017eb78fecfbf`, published on branch commit `f8c0e938b43983529df87af11f9f2bf8d406b3ca` and unchanged by merge-ancestry commit `5df66dcee973e4c9427d6be110ac590fc63a9993`. At the available `1363 × 936` viewport, standard, review, guide, and ranked-list runtimes each reported `documentElement.scrollWidth=1348`, no wider than the viewport; the previously fixed 1240px track set now contracted to `132px 550px 376px`. Dark and light article states both remained overflow-free. The image viewer opened by pointer and keyboard, retained alt/caption/credit and four-image navigation, kept its Close control inside the viewport, and returned focus to the invoking image after pointer Close and Escape. Homepage search retained nine results for `elden ring` and returned focus to the search trigger within the immediate post-close check for both pointer- and keyboard-opened flows. The signed-out author button settled as `FOLLOW`, `aria-pressed=false`, without followed styling. No site-owned console exception appeared; browser-extension metadata errors were external, and the canary logged the existing audience-signals fallback warning. The browser exposes no supported viewport mutation, so this does not prove mobile, tablet, or wide-desktop behavior.

## Verified pre-existing bugs and gaps

| ID | Finding | Evidence | Branch-introduced? |
|---|---|---|:---:|
| `BUG-M1-01` | The legacy `/article.html?slug=…` route can finish with the query URL in canonical and `og:url`, while the clean shell correctly self-canonicals. `public-hardening.js` and `story-router.js` race asynchronously. | `E-CANONICAL-BROWSER`; source inspection | No |
| `BUG-M1-02` | `/games/` and `/reviews/` runtime titles are overwritten with the homepage title by nested-path handling in `public-hardening.js`. | `E-BROWSER-PUBLIC`; source inspection | No |
| `BUG-M1-03` | Private tooling pages emit a Supabase warning about multiple GoTrue clients sharing one storage key. | `E-BROWSER-CONSOLE` | No |
| `GAP-M1-01` | Game identity exists on `39/53` stories (`14` absent), but `23` populated `gameKey` references have no matching Games Database record; only `7` full game pages exist. | existing games audits; `E-AUDIT-PUBLIC` | No |
| `GAP-M1-02` | Three review rows lack tested-platform metadata: Baldur’s Gate 3, Red Dead Redemption 2, and Super Mario Odyssey reviews. | existing review audit; `E-AUDIT-PUBLIC` | No |
| `GAP-M1-03` | RSS intentionally/operationally contains only the newest `30` of `53` stories, and its `lastBuildDate` is generated non-deterministically. | source/build inspection; `E-AUDIT-PUBLIC` | No |
| `GAP-M1-04` | The repository lacks the original migrations for several mature base tables, so a fresh local Supabase recreation cannot be proven from version control alone. | `E-SUPABASE-STRUCTURE` | No |
| `GAP-M1-05` | The game directory Upcoming state currently has no mapped game records. | `E-BROWSER-GAMES` | No |
| `BUG-M3-01` | The representative article overflows horizontally at `1363 × 936`: document width `1534`, with `.work-article-sidebar` reaching the overflow edge. | `E-ARTICLE-BROWSER-M3`; production comparison | No |
| `BUG-M3-02` | The exact branch labels the signed-out author control `FOLLOWING`, but activation opens sign-in. Current production labels the same state `FOLLOW`, exposing branch drift. | `E-INTERACTION-M3`; production comparison | No Milestone 3 product edit |
| `BUG-M3-03` | Image-viewer Escape closure leaves focus on `BODY` instead of the invoking image. | `E-ARTICLE-BROWSER-M3`; production comparison; source inspection | No |
| `BUG-M3-04` | Search-overlay Escape closure on the exact canary leaves focus on `BODY` rather than the search trigger. | `E-INTERACTION-M3` | No Milestone 3 product edit |

## Milestone 2 resolution and new findings

| ID | Exact branch state | Evidence | Remaining verification |
|---|---|---|---|
| `BUG-M1-01` | Fixed by making Story Router the explicit canonical contract and making hardening consume the clean story URL. | `E-PROTECTED-RUNTIME-M2`; `E-CANONICAL-BROWSER-M3` | Legacy runtime is exact-branch browser-verified; clean runtime hydration remains blocked by the canary base path. |
| `BUG-M1-02` | Fixed by applying homepage hardening only when the homepage's real hero and feed surfaces exist. | `E-PROTECTED-RUNTIME-M2`; `E-TITLE-BROWSER-M3` | Exact shell titles are correct; Games/Reviews post-script browser settlement remains blocked by the canary base path. |
| `BUG-M1-03` | Fixed in source by creating one private Supabase client and making both Newsroom consumers reuse it. | `E-PROTECTED-RUNTIME-M2`; `E-PRIVATE-CONSOLE-M3` | Exact signed-out private pages emit no duplicate-client warning; authenticated consumers remain blocked. |
| `SEC-M2-01` | Pre-existing Supabase Auth leaked-password protection is disabled; deliberately not changed without operational authorization. | `E-SUPABASE-ADVISOR-M2` | Authorized owner decision and post-change auth regression testing. |

## Milestone 4 reader-baseline resolution

| ID | Exact branch state | Evidence | Remaining verification |
|---|---|---|---|
| `BUG-M3-01` | Fixed by allowing the three desktop article tracks to contract beneath their 1240px reference maxima. Four article formats are overflow-free at the reproduced 1363px viewport. | `E-READER-BASELINE-M4`; `E-READER-BROWSER-M4` | Real narrow, intermediate, and wide viewport mutation remains unavailable. |
| `BUG-M3-02` | Fixed in the existing article/community owners. Signed-out author follow settles as `FOLLOW`, unpressed and unstyled. | `E-READER-BASELINE-M4`; `E-READER-BROWSER-M4` | Signed-in follow persistence remains blocked by the lack of an approved fixture. |
| `BUG-M3-03` | Fixed by retaining the invoking image in the shared viewer close path and restoring it after Close/Escape. Scaled viewer rows are constrained so Close stays on-screen. | `E-READER-BASELINE-M4`; `E-READER-BROWSER-M4` | Real mobile viewport behavior remains unverified. |
| `BUG-M3-04` | Fixed by restoring to the connected/current search trigger on an immediate task rather than a throttle-prone animation frame. | `E-READER-BASELINE-M4`; `E-READER-BROWSER-M4` | No exhaustive assistive-technology pass was performed. |

## Milestone 3 boundary

Milestone 3 produces exact-commit CI and browser evidence and no product repair. No public runtime, CSS, template, schema, migration, RLS, provider, auth setting, or benchmark capability changes. The exact canary's hosting and credential limitations remain visible. Capability rows change only where real browser evidence supports them; one desktop capability is downgraded because a reproducible overflow invalidates its prior complete classification.

## Final branch validation

All commands below exited `0` on the final Milestone 3 working tree unless a limitation is explicitly stated.

Publication generation:

```bash
python scripts/build_runtime_fallback.py
python scripts/build_robots.py
python scripts/build_sitemap.py
python scripts/build_story_pages.py
python scripts/build_topic_pages.py
python scripts/build_game_pages.py
python scripts/build_author_pages.py
python scripts/enrich_story_metadata.py
```

Results: `53` live/fallback articles, `53` canonical story shells, `72` topic hubs, `7` game pages, `1` author hub, and enrichment of `53/53` shells. The builder's expected non-deterministic RSS timestamp-only drift was discarded; generated public state has no branch diff.

All audit entry points:

```bash
for audit_script in scripts/audit_*.py; do python "$audit_script"; done
```

All `21` audit scripts exited `0`. Known warnings remained visible: three reviews missing tested platform, `23` article game keys without Games Database records, and `23` stories outside the newest-30 RSS cap.

New focused gates:

```bash
python scripts/render_capability_ledger.py --check
python scripts/audit_capability_ledger.py
python scripts/audit_content_parity.py
node scripts/test_protected_runtime.js
python scripts/audit_live_auth_boundaries.py
python scripts/manage_verification_identities.py plan
```

Results: Markdown synchronized with exactly `200` rows and IDs `NC-GS-001` through `NC-GS-200`; ledger `0` errors/`0` warnings with `✅=125, 🟡=69, ❌=6, 🚫=0` and `V0=0, V1=6, V2=109, V3=81, V4=3, V5=1`; parity `0` errors with `live=53, fallback=53, details=53, shells=53`; protected runtime `5/5`; the live public control succeeded and all seven protected anonymous table reads returned HTTP `401`; identity plan performed no network call or write.

Syntax and workflow checks:

```bash
node --check <each of 90 JavaScript files>
python -m py_compile <each of 35 Python files under scripts/>
python <PyYAML safe-load of all 6 .github/workflows/*.yml files>
git diff --check
```

All passed. The baseline audit secret-scan found no service-role/provider secret in client-facing HTML/JavaScript/JSON files. Service-role variable names remain confined to operator tooling/runbooks; no credential value exists in the repository.

Exact-branch browser evidence is summarized by `E-*-M3`. It covers a signed-out desktop canary, hydrated public/private routes, the compatibility article runtime, canonical/share ownership, clipboard behavior, theme reload persistence, and representative pointer/keyboard states. It does not cover real mobile width, root-hosted clean-shell hydration, authenticated writes, editor/admin authorization, or provider delivery. Those remain explicitly blocked rather than passed.
