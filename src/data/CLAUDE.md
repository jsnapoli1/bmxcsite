# Data modules

All user-facing copy lives here so content edits never touch components.

| File | Holds |
|---|---|
| `camp.js` | Camp facts, stats, pillars, daily schedule |
| `faq.js` | 44 questions across 7 categories + mail addresses |
| `registration.js` | Price tiers, bus routes, deposit, fine print |
| `staff.js` | Roster, credentials, guest speakers |
| `packing.js` | Packing list by category |
| `merch.js` | 3 apparel items, facts, caveats, included shirts |
| `playlists.js` | Spotify playlists (BMXC23-26) |
| `videos.js` | YouTube videos (15, spanning 2007-2023) |

## Notes

**FAQ answers are quoted verbatim** from the camp. Their phrasing — including
the em-dashes — is intentional. Don't restyle it.

**Prices:** the camp publishes a `$15-40` range for merch, not per-item
figures. `merch.js` deliberately carries no per-item prices.

**Playlists and videos parse IDs from URLs.** Paste any standard share link
into `url`; `getSpotifyEmbedId` / `getYouTubeId` extract the ID, so no separate
ID field is needed.

**`videos.js` descriptions are written, not from the channel** — they describe
footage that was never watched. Unverified.
