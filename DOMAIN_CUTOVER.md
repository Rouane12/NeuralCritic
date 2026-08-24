# Neural Critic — Production Domain Cutover

Neural Critic currently publishes from `https://rouane12.github.io/NeuralCritic/`.

The publication builders now read the public origin from the `NEURAL_CRITIC_SITE_URL` environment variable. If it is unset, they keep the existing GitHub Pages origin exactly as-is.

## Before DNS changes

- Register the final Neural Critic domain.
- Decide the canonical host (`www` is recommended for GitHub Pages, with the apex redirecting to it).
- Verify the domain in GitHub before attaching it to the Pages site.
- Confirm the domain resolves over HTTPS before changing canonical metadata.

## Cutover sequence

1. Configure DNS for the selected domain and GitHub Pages.
2. Add the custom domain in the repository Pages settings and enable HTTPS when GitHub makes the option available.
3. Set the publication workflow environment variable:
   - `NEURAL_CRITIC_SITE_URL=https://www.example.com/`
4. Regenerate story shells, sitemap/RSS, topic hubs, writer pages, and metadata enrichment.
5. Verify generated `<base href="/">`, canonical URLs, Open Graph URLs/images, JSON-LD, sitemap URLs, and feed URLs.
6. Update Supabase Auth Site URL and allowed redirect URLs to the production domain while temporarily retaining the GitHub Pages URL during transition.
7. Verify the production-domain property in Google Search Console and submit the new sitemap.
8. Confirm GA4 receives the same publication events on the new origin.
9. Keep the old GitHub Pages origin available long enough to validate redirects/canonical convergence before treating the migration as complete.

## Rollback

Unset `NEURAL_CRITIC_SITE_URL` and rebuild. The publication pipeline will return to the current GitHub Pages origin and `/NeuralCritic/` base path.
