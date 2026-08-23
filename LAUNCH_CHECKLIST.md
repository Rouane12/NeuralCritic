# Neural Critic — Production Launch Checklist

This checklist separates automated release gates from external settings that require a provider/dashboard action.

## Automated release gates

- [x] Canonical story shells generated from published CMS stories
- [x] Canonical story URLs used by sitemap and RSS
- [x] Canonical writer and Game Graph hubs generated
- [x] Article structured data includes canonical writer identity
- [x] Publication Health audit runs on pull requests and main
- [x] Final Launch Gate checks local links/assets and release-sensitive integrations
- [x] Private Studio, Subscribers, and Newsroom surfaces are noindex/nofollow and blocked in robots.txt
- [x] Newsroom uses the minimal Supabase browser config and does not boot the public monetization/analytics/router stack
- [x] Core Web Vitals instrumentation covers LCP, CLS, and INP behind analytics consent
- [x] Public accessibility runtime includes skip navigation, focus-visible treatment, and dialog keyboard behavior
- [x] Advertising remains disabled by default
- [x] Ad serving requires provider readiness, a real publisher ID, and a separate consent gate
- [x] Affiliate and sponsored story disclosure metadata is explicit and reader-visible
- [x] New Reader/Editor account creation requires an 8+ character password in the UI
- [x] Existing account sign-in remains backward-compatible
- [x] Published CMS integrity check reports no missing title, summary, image, image alt text, publish timestamp, News classification, or News source
- [x] Editorial workflow audit foreign keys have covering indexes

## External provider / dashboard checks

- [ ] **Supabase Auth:** enable leaked-password protection in Authentication settings when available on the project plan.
- [ ] **Supabase Auth:** configure production custom SMTP before relying on account-confirmation/recovery email at meaningful scale.
- [ ] **Domain:** move Neural Critic to its production domain/subdomain before the commercial launch if possible.
- [ ] **Google Search Console:** verify the production domain property and submit the production sitemap after domain cutover.
- [ ] **Google Analytics:** manually test Accept and Decline analytics-consent paths in a clean browser profile.
- [ ] **Ads:** do not enable `adsEnabled` until a real provider/publisher ID and consent platform are configured; create `ads.txt` only from the provider's real publisher record.

## Manual release smoke test

Run once on the final production origin before announcing broadly:

- [ ] Desktop Chrome/Edge: homepage, search, category, story, writer hub, topic hub
- [ ] Mobile viewport: navigation, search, article reading, comments/account modal
- [ ] Light mode and dark mode on homepage + article
- [ ] Reader signup/sign-in/sign-out and profile update
- [ ] Comment/reaction flow on one published article
- [ ] Canonical story share action
- [ ] Newsroom sign-in → select story → Open in Studio
- [ ] Studio draft save and reopen without publishing
- [ ] Commercial Disclosure, Privacy, Editorial Standards, About, and 404 recovery
- [ ] Confirm no advertisement appears while monetization config is disabled

## Launch rule

A commit is technically releasable when both `audit_publication_v2.py` and `audit_launch.py` pass. Broad public/commercial announcement should additionally complete the relevant external/manual items above.
