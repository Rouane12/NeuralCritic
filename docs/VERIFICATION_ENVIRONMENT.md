# Neural Critic verification environment

This runbook supports evidence collection without using personal accounts, weakening RLS, exposing service credentials, or pretending that a control proves persistence.

## Current environment state

- Public production is available for signed-out and read-only verification.
- `overhaul/baseline-regression-safety` now exists remotely as an unmerged draft pull request. Publication Health passed on exact commit `cfc8f993abbb2ea246c7b8182d4acfec6aea8ac5`, tree `bf173b15b5a59c2c1d9625fbd0e65849df222d00`.
- A real Chrome exact-commit canary is available through an immutable commit-CDN path. Fully hydrated checks are possible for the homepage, category/search, legacy article runtime, Studio, Newsroom, and Subscriber Desk. Generated nested shells use `<base href="/">`, so their root-relative assets cannot hydrate correctly beneath the CDN's commit subpath; use a root-hosted exact-branch preview for final clean-story, Games, Reviews, game, and topic runtime proof.
- The available browser controller exposes a desktop `1363 × 936` viewport but no supported viewport mutation. Do not claim mobile verification from this environment.
- The live published article dataset is readable through the existing publishable client configuration and exactly matches the generated fallback at the recorded Milestone 1 check.
- The connected production Supabase project currently has no disposable development branch. Read-only catalog inspection confirms RLS enabled on 11 relevant reader/editor/admin tables, and the live anonymous boundary audit receives authorization denials from all seven directly tested protected tables.
- No safe reader, editor, or admin test identity was available in this workspace.
- No service-role, newsletter-provider, commerce-provider, or synthetic-subscriber credential was available. The shell push path was blocked before network contact; an authorized GitHub repository connection was used for the branch and draft pull request.
- Supabase CLI and a complete base-schema migration history are not present, so a faithful local Supabase clone cannot be created from this repository alone.
- Therefore no identity was created and no authenticated write was claimed. The provisioning tool is ready for an authorized operator-controlled environment.
- Supabase's live security advisor reports that leaked-password protection is disabled. Milestone 3 does not alter this production setting; an authorized owner should evaluate it with signup, sign-in, recovery/password-update, session, Reader, Studio, and Newsroom regression coverage.

## Verification identity contract

Use three dedicated, non-personal identities:

| Identity | Intended scope | Required profile |
|---|---|---|
| Reader | Reader auth, profile/avatar, comments/reactions/replies, Save, follows, Following feed | `reader_profiles`; no `editor_profiles` row |
| Editor | Studio and Newsroom editorial journeys | `reader_profiles` plus `editor_profiles.role = editor` |
| Admin | Subscriber Desk, moderation, admin-only/provider paths | `reader_profiles` plus `editor_profiles.role = admin` |

Every address must use an `nc-verify-` local part or a `+nc-verify-` alias. Do not reuse a personal identity. Passwords must be at least 16 characters, must be supplied only through the operator environment, and are never written to the repository or manifest.

## Guarded provisioning

First inspect the no-write plan:

```bash
python scripts/manage_verification_identities.py plan
```

In an authorized server/operator environment, set these variables without committing or printing their values:

```text
NC_VERIFY_SUPABASE_SERVICE_ROLE_KEY
NC_VERIFY_READER_EMAIL
NC_VERIFY_READER_PASSWORD
NC_VERIFY_EDITOR_EMAIL
NC_VERIFY_EDITOR_PASSWORD
NC_VERIFY_ADMIN_EMAIL
NC_VERIFY_ADMIN_PASSWORD
```

Then use the exact project ref and confirmation phrase printed by `plan`:

```bash
python scripts/manage_verification_identities.py provision \
  --confirm-project <printed-project-ref> \
  --confirm CREATE_NC_VERIFICATION_IDENTITIES
```

The helper uses Supabase Auth Admin server-side, marks each user in immutable authorization metadata, confirms email without real inbox use, creates only existing profile rows, and writes `.verification/identities.json` with IDs/emails/roles only. It does not create tables, alter grants, edit RLS, or embed the service role in client code.

## Guarded cleanup

Cleanup deletes only the explicit IDs in the local marked manifest:

```bash
python scripts/manage_verification_identities.py cleanup \
  --confirm-project <printed-project-ref> \
  --confirm DELETE_NC_VERIFICATION_IDENTITIES
```

If the manifest is missing, malformed, or points at another project, cleanup refuses to proceed. Before deletion it re-reads each Auth user and requires the immutable fixture marker and matching email; already-absent fixture IDs are handled idempotently. Never replace this with broad user deletion.

## Persistent journey protocol

For any capability that claims persisted state, record this sequence:

```text
known signed-in identity
→ read initial server state
→ perform the real UI action
→ observe a successful real request
→ re-read the server source independently
→ reload the page or resume the session
→ confirm the UI still matches the server
→ exercise the inverse/cleanup action
→ confirm an unauthorized role cannot perform it where applicable
```

Use that protocol for profile/avatar, article Like, comment/reply/votes, Save, entity follows, Following feed, workflow state, subscriber changes, and publication operations. Local-only preferences such as theme still require a reload check, but do not require a server write.

## Browser QA checklist

Record URL, viewport class, theme, auth role, visible result, console errors, failed requests/resources, API outcome, source re-read, reload outcome, and cleanup outcome.

Authenticated reader run:

- Create account and verify initial reader profile.
- Sign out/in and verify session continuity according to the selected persistence test.
- Change display name; re-read `reader_profiles`; reload.
- Upload a disposable avatar; verify Storage path and `avatar_url`; reload; remove test asset after the run.
- Post a disposable comment; reload; edit; reload; reply; reload; vote Like then Dislike; reload each state; copy the permalink and resolve it.
- Toggle article Like, Save, game/series/franchise follow; re-read each table and reload.
- Confirm Following feed includes only applicable followed entities; remove all test rows and verify cleanup.

Editor run:

- Confirm a reader identity cannot pass Studio/Newsroom approval.
- Sign in as editor and verify the existing story library.
- Create a uniquely prefixed draft only; save and reload.
- Update a disposable workflow row; re-read and reload.
- Exercise schedule/publish only in an approved staging or production-equivalent environment with an explicit cleanup/rollback plan. Do not publish test content to the public site merely to raise a verification level.

Admin run:

- Confirm editor and reader identities cannot access admin-only Subscriber Desk mutations.
- Verify subscriber listing without exposing addresses in logs/evidence.
- Use a dedicated synthetic subscriber if provider delivery is authorized; verify capture, provider sync, unsubscribe propagation, and cleanup.
- Exercise moderation on the reader fixture’s disposable content and verify RLS/role rejection paths.

## Canonical and parity checks

Protected runtime ownership and ordering on the exact branch:

```bash
node scripts/test_protected_runtime.js
```

Read-only live anonymous boundary check:

```bash
python scripts/audit_live_auth_boundaries.py
```

The boundary audit uses only the browser publishable key and GET requests. A public-article control must succeed, then every expected protected table must deny the request. An empty HTTP 200 and a missing table both fail because neither proves authorization enforcement. This does not replace credentialed reader/editor/admin positive and negative tests.

Static and live data parity:

```bash
python scripts/audit_content_parity.py
```

Offline repository-only parity:

```bash
python scripts/audit_content_parity.py --static-only
```

For browser parity, compare the same story on the clean shell and legacy runtime route after the runtime has settled. Record address-bar compatibility state separately from `link[rel=canonical]`, `og:url`, JSON-LD URL, Share output, and sitemap/feed URLs.

## Evidence boundary

The current evidence can legitimately prove exact-commit GitHub Actions health; exact-branch signed-out desktop behavior on fully hydrated canary routes; exact compatibility-route canonical/share ownership; static clean-shell metadata; representative pointer/keyboard behavior; private-page singleton console behavior; static/build contracts; live/fallback parity; deterministic protected-runtime integration; signed-out live API denials and gates; copy/share behavior; and local theme persistence. It cannot prove mobile width, fully hydrated clean/nested routes on a root host, authenticated persistence, privileged authorization, provider delivery, or production-equivalent publication. Those paths remain 🟡 rather than being promoted from source or optimistic UI.
