# Neural Critic overhaul closeout note

This bounded cleanup closes the last known primary-navigation seam after the major overhaul milestones.

- Reviews primary navigation resolves directly to `/reviews/`.
- Guides primary navigation resolves directly to `/guides/`.
- Platform-specific Review and Guide links preserve their platform query on the canonical hub.
- Homepage service-desk links resolve directly to the canonical Review and Guide hubs.
- Legacy `category.html?section=reviews` and `category.html?section=guides` routes remain compatibility paths for old inbound links; they are no longer intentional primary navigation destinations.
- No new recommendation, taxonomy, Game Graph, publishing, auth, commerce, or analytics system is introduced.
- Capability counts are not changed by this cleanup.

After this change is verified and deployed, the major overhaul phase should be considered closed. Future engineering work should be driven by production defects, measurable reader friction, or growth opportunities rather than additional platform milestones.
