# Readership campaign attribution

## Existing owners and journey

- `scripts/build_story_pages.py` owns the generated story bootstrap. It briefly rewrites a canonical story to `article.html?slug=...` for the shared article runtime.
- `assets/story-router.js` restores the clean story URL and owns canonical/share URLs.
- `assets/analytics.js` owns GA4 configuration, page/event measurement, and consent.
- `assets/supabase-config.js` loads the versioned analytics runtime.

The current bootstrap discards the incoming query string before analytics runs. A reader arriving with `utm_source`, `utm_medium`, and `utm_campaign` therefore loses the campaign labels. Canonical page identity should remain clean, but campaign attribution should survive that bootstrap.

The regression test executes the actual generated bootstrap and analytics runtime together. Before the fix, the tagged canonical-story case must fail because the GA4 configuration has no campaign source.

## Scope

Capture only the five supported campaign label fields (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_id`) before the existing rewrite. Accept short URL-safe labels only. Pass them through the existing GA4 configuration, without retaining a raw entry URL, adding storage, changing consent, changing canonical URLs, or propagating campaign labels to internal links.

This extends the existing bootstrap and analytics owners. It does not introduce another router or measurement provider.

## Verification

- Reproduced the defect: the unmodified generated shell failed the campaign-source assertion.
- Five regression groups now pass: canonical-story attribution and event uniqueness; early route restoration; legacy/homepage entries; untagged/unsafe/oversized values; consent and private-page exclusion.
- The test also compares the checked-in bootstrap with output from the current publication builder.
- Protected runtime suite: 5/5 checks passed. Continue Exploring suite: 14/14 checks passed.
- Runtime consistency passed for all 121 published story shells. Publication and reliability audits passed; existing coverage-metadata, RSS-cap, and large-image warnings remain.
- Canonical/share routing is unchanged. Generated bootstrap updates and shared-config cache pins account for the broad HTML diff.
- Production workflow and first-campaign reporting verification are still pending. A queued GA4 configuration is not proof of processed production attribution; the first real campaign must also be checked after GA4 processing.
