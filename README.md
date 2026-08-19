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

The first migration preserves the public reading experience, dark/light themes, categories, filters, search, article pages, review scoring, and newsletter UI. The original ChatGPT Studio publishing backend is not part of GitHub Pages and can be rebuilt separately later.
