# Milestone 5 reader hierarchy contract

Milestone 5 changes presentation and navigation only. Existing editorial programming, Discovery Intelligence, Popularity Signals, search, Game Graph, newsletter, account, analytics, canonical routing, and publication systems remain authoritative.

## Existing owners reused

| Surface | Existing owner | Milestone 5 use |
| --- | --- | --- |
| Shared header, footer, theme, homepage renderers | `assets/app.js` | Clarify labels, landmarks, service-story presentation, and footer destinations without creating another shell. |
| Editorial lead/supporting selection | `assets/discovery-intelligence.js`, `assets/home-curation-guard.js`, publication metadata | Preserve programmed lead and secondary slots; improve hierarchy and canonical-link presentation only. |
| Latest feed | `assets/home-feed.js` | Preserve chronological/filter behavior and progressive loading; give Latest a clearer role in the page. |
| Trending and Most Read | `assets/popularity-signals.js` | Preserve the existing ranking and time-window logic; distinguish each mode with explanatory presentation and avoid adjacent lead duplication. |
| What to Play and curated collections | `assets/home-what-to-play.js`, `assets/curated-collections.js` | Preserve editorial collection authority; expose high-value Game Graph and Games-directory paths in the same module. |
| Global publication navigation | `assets/publication-nav.js`, `assets/publication-nav.css` | Keep the existing dropdown/accordion owner while making all six core desks direct, crawlable destinations. |
| Search | `assets/app.js`, `assets/search-parity.js`, `assets/discovery-intelligence.js` | Keep the existing overlay and full search page; search remains a utility. |
| Reader account | `assets/reader-account.js` | Preserve the existing sign-in/account entry and session behavior. |
| Newsletter | `assets/newsletter.js`, public-actions Edge Function | Preserve capture, source attribution, status, and analytics behavior. |
| Analytics | `assets/analytics.js`, existing module-specific events | Extend the existing tracker only for genuinely new navigation/service-card interaction classes. |

## Intended reader journey

1. **Orient.** The header immediately exposes News, Reviews, Guides, Features, What to Play, and Games. Search, theme, and account remain a separate utility cluster.
2. **Understand the front page.** One editorially programmed lead answers “what is the biggest story right now?” Two supporting stories answer “what else is happening?” without competing at the same scale.
3. **Catch up or follow attention.** Latest is chronological publication output. Trending is current editorial/audience momentum. Most Read is measured readership over its stated time window. These meanings remain visibly distinct.
4. **Make a useful choice.** Reviews and Guides form a compact service desk, leading readers to a verdict or practical help without displacing the main news flow.
5. **Decide what to play.** Existing curated rankings and collections remain authoritative, followed by high-value Games and Game Graph paths for deeper exploration.
6. **Continue the journey.** Every programmed card remains a real anchor to a canonical story, game/topic surface, or publication desk, supporting `Homepage → Story → Game/Topic → Related Coverage → Next Story` and `Homepage → Reviews/Guides/What to Play → Story → Game Hub`.
7. **Return.** The existing Weekly Drop surface offers newsletter acquisition after the page has established editorial value. The footer repeats durable discovery paths and policy links.

## Presentation constraints

- Keep one dominant lead and at most two immediate supporting stories.
- Do not invent content or ranking logic.
- Do not repeat a programmed lead/supporting story in an adjacent service module when another eligible published story exists.
- Keep page-level horizontal overflow at zero across the accepted viewport classes.
- Preserve light/dark contrast, visible focus, reduced-motion behavior, semantic landmarks, and canonical metadata.
- Keep conditional commerce conditional and outside the editorial hierarchy.
