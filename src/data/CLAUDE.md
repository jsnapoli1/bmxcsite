# Data modules

All user-facing copy lives here so content edits never touch components.
Every fact is sourced from bluemountainxccamp.com — see root CLAUDE.md.

| File | Source |
|---|---|
| `camp.js` | Home page + `/location.html` |
| `faq.js` | `/faq.html` (44 questions, 7 categories) |
| `registration.js` | `/registration.html` (real prices) |
| `staff.js` | `/staff.html`, `/guest-speakers.html` |
| `packing.js` | `/packing-list.html` |
| `merch.js` | `/apparel.html` (3 real products) |
| `playlists.js` | Camp's Spotify (BMXC23-26) |
| `videos.js` | Camp's YouTube (15 videos, 2007-2023) |

## Rules

**No invented facts.** Prices, product names, dates, staff, and policies must
trace to a real source. `merch.js` once carried three products that did not
exist and per-item prices the camp never published.

**Quoted FAQ answers stay verbatim.** Don't restyle the camp's own sentences.

**Playlists/videos parse IDs from URLs.** Paste any standard share link into
`url`; `getSpotifyEmbedId` / `getYouTubeId` extract the ID. Only `videos.js`
descriptions are written rather than sourced — flagged, unreviewed.
