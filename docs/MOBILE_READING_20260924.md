# Mobile reading and loading pass — 24 September 2026

## Findings and changes

- At 320px, the guide's Reading Map appeared after more than 13,000px of article text. The existing map now moves into a native, initially collapsed **In this article** disclosure before the body at widths up to 900px. Resizing restores the same node to the desktop sidebar. `article-runtime-integrity.js` remains the sole link/scroll/hash owner.
- Public navigation waited for `window.load`, making menu enhancement depend on outstanding media. It now starts at DOM readiness. Studio keeps its previous initialization timing.
- Publication taxonomy pages now consume the shared bounded Content API index instead of issuing an additional unbounded public article query. The caller receives a separate array so sorting cannot mutate the shared index.
- Main homepage/article images receive eager loading and high fetch priority in their initial markup. Supporting cards and inline article images receive lazy loading before insertion. The performance observer respects explicit noncritical loading hints and prioritizes only the category's main spotlight.
- Reading sections and touch browsing no longer start transparent for scroll reveals. Pointer glow is limited to devices with a fine pointer and hover.
- Mobile menu, search, theme and submenu controls have 44px targets. Like/Share icons use inline SVG, so a missing external icon font cannot turn them into clipped text.

## Verification

The expanded browser workflow exercises 13 route/viewport/theme combinations: desktop home, two news stories, category, search and game; two 390px news stories; 320px light, 390px dark and 768px light homepages; a 320px light guide; and a 390px dark game hub.

It verifies geometry, menu/submenu interaction and Escape focus, eager lead images, menu initialization with image requests held open, mobile map disclosure, keyboard section navigation to visible content, map identity after desktop resize, and uncaught page exceptions. It retains screenshots and the JSON report for review.

- Baseline: [browser run 35952268743](https://github.com/Rouane12/NeuralCritic/actions/runs/35952268743). The new theme fixture initially attempted localStorage in sandboxed video frames; this test setup error was corrected by restricting it to the first-party origin.
- Main implementation: [browser run 35953025340](https://github.com/Rouane12/NeuralCritic/actions/runs/35953025340), **13/13 passed**, 27 screenshots. All nine PR workflows passed at `20e2776b8b39b01d78c7f87c2138b41f3cd109bb`.
- Screenshot review exposed the font-dependent reaction icons; the final follow-up replaces them and adds a rendered SVG check. Final head/release results are recorded in [PR #102](https://github.com/Rouane12/NeuralCritic/pull/102).
- Local gates passed: publication refinement (12), protected runtime (5), reader baseline (4), home/navigation (12), navigation hotfix (5), article reading (11), article journey (11), Continue Exploring (14), Weekly Drop (12), and article ending (10); runtime consistency, discovery links, site integrity and publication reliability audits. Reliability retained 23 existing content warnings and zero errors.
- Desktop branch review confirmed one sidebar map, working section navigation, eager/high-priority article hero, and no concealed reading sections.
- PR #102 deployed successfully via Pages run 35953489887. Live verification confirmed the new assets, clean canonical guide route, visible reading sections and inline action icons. It also exposed `public-hardening.js` overriding supporting hero hints; the release follow-up makes that compatibility enhancer respect explicit loading attributes and adds a rendered supporting-image assertion. This closes the discrepancy between correct initial markup and final page state.
- Generated HTML differences were checked to contain asset-version refreshes only. No article copy, ranking, authentication, persistence or database policy changes.

## Evidence limits

CI uses Chrome viewport and touch emulation with external requests blocked; it verifies the generated-content fallback, including resilience when fonts/SDKs are unavailable. This is not physical-device or Safari testing. No field LCP/CLS/INP improvement is claimed from these deterministic checks. Live root-hosted verification follows deployment; the commit preview has known subpath limitations for root-relative images and generated links.
