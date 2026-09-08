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

**`staff.js` members carry a `slug`, and it is load-bearing.** It is the
person's `/staff/<slug>` URL and the key vedit stores an override against, so
it must survive a name being corrected: mint one for a new member, then leave
it alone. Accolades carry their own ids for the reason every list here does —
an id built from the text reattaches the moment someone rewords it.

Staff groups have no id. A group is a title and a sort order in D1 and nothing
more, so renaming one orphans its override. Worth fixing if groups ever gain
an id column; until then, do not add one to this file — it would not reach the
database and would imply a stability it does not have.

**Guest speakers and credentials are CMS-backed now.** They were static, which
meant a director could not add a speaker without a deploy. What is here is the
fallback `useContent` renders before the API answers, and if the API is empty.
