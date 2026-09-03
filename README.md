# Neural Critic

Independent gaming news, reviews, guides, and features.

This repository is the standalone migration of the original Neural Critic ChatGPT Site. It is intentionally framework-free so it can be edited directly in GitHub and hosted with GitHub Pages.

## Structure

- `index.html` — homepage
- `article.html?slug=...` — article/review renderer
- `category.html?category=...` — category archive
- `search.html` — client-side search
- `data/articles.json` — editorial content
- `assets/site.css` — recovered design system + standalone additions
- `assets/app.js` — theme, filters, search, rendering
- `images/` — recovered editorial images

## Notes

The first migration preserves the public reading experience, dark/light themes, categories, filters, search, article pages, review scoring, and newsletter UI. Editorial Studio, Newsroom Operations, Subscriber Desk, and the publishing pipeline are now layered Supabase-backed systems; audit their current owners and security boundaries before modifying or extending them.

## Overhaul regression baseline

The current architecture contract, protected systems, regression matrix, and verification instructions live in [`docs/OVERHAUL_BASELINE.md`](docs/OVERHAUL_BASELINE.md). The populated 200-capability inventory lives in [`docs/CAPABILITY_STATUS.md`](docs/CAPABILITY_STATUS.md) and [`docs/CAPABILITY_STATUS.csv`](docs/CAPABILITY_STATUS.csv). Reproducible evidence and safe authenticated-test prerequisites are recorded in [`docs/VERIFICATION_EVIDENCE.md`](docs/VERIFICATION_EVIDENCE.md) and [`docs/VERIFICATION_ENVIRONMENT.md`](docs/VERIFICATION_ENVIRONMENT.md); [`docs/MILESTONE_1_REPORT.md`](docs/MILESTONE_1_REPORT.md) is the completion summary.

Run the cross-system baseline check with:

```bash
python scripts/audit_overhaul_baseline.py
python scripts/render_capability_ledger.py --check
python scripts/audit_capability_ledger.py
python scripts/audit_content_parity.py
node scripts/test_protected_runtime.js
node scripts/test_reader_baseline.js
node scripts/test_home_navigation.js
```

This check complements, rather than replaces, the existing domain-specific publication audits.
