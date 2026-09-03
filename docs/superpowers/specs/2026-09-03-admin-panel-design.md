# Admin panel: redesign, email, media, face tagging

Four changes to `/admin`, sequenced so each ships on its own:

1. **Redesign** — responsive layout, shared form and table primitives.
2. **Media** — albums, multi-file upload, video.
3. **Email** — staff `@bmxc.camp` addresses, and a subscriber list.
4. **Faces** — permission, proxy route, consent gate. Not deployed.

The order is not arbitrary. The redesign changes every page the other
three add to, so doing it last would mean restyling work that had just
been written.

## What is already there

Worth stating, because three of the four are less new than they look.

**Email Routing is live on bmxc.camp.** Enabled, status `ready`, since
2026-08-23. Rules for `ken@` and `sarah@` already forward to a personal
Gmail, alongside a catch-all. They were made by hand in the dashboard.
The email work puts a UI on a workflow that already runs.

**The media library exists.** R2-backed, with a private/public split, alt
text required before publishing, and a `media` permission. What it lacks
is albums, multi-file upload, and video.

**Email Sending is not onboarded.** `wrangler email sending list` shows
only `send.letssimplif.ai`. Sending from `bmxc.camp` needs
`wrangler email sending enable bmxc.camp` plus DNS records.

## 1. Redesign

`AdminApp.jsx` renders a `max-width` column with a wrapping row of
buttons. `admin.css` has no media queries, so on a phone the Users
permission grid — five toggle columns — overflows horizontally.

- Sidebar nav on desktop; a top bar with a drawer below 48rem.
- Tables become stacked rows on narrow screens, each cell labelled.
- Form, field, button and table primitives extracted into one place.
  `admin.css` currently restates input styling per page.
- One vocabulary for busy, empty and error states. Every page invents
  its own today.

The Field Guide direction from CLAUDE.md holds: serif display, warm
paper, no shadows, radii 2-6px, structure from rules and weight. The
bans hold too — no uppercase headings, no gradient text, no pill
buttons, no hover lifts.

Verified in a browser at mobile, tablet and desktop widths before it is
called done, per the `verify-ui` skill.

## 2. Media

**Albums.** One `albums` table and an `album_id` on `media`. This is
what makes the page a library rather than a bucket, and it is what the
face work later needs to scope ingest to one session.

**Multi-file upload.** Drag and drop, one progress row per file, one
failure does not abandon the rest. Uploads stay private on arrival, as
they do now.

**Video.** A new media type. `video/mp4` and `video/quicktime`, a size
ceiling, a poster frame for the grid. The private/public split and the
alt-text gate apply unchanged.

**Bulk select** for publish and unpublish. The confirmation names the
count and stays as blunt as the current single-item one: publishing
means anyone on the internet.

The existing rule that private media has no public URL does not move.
`/media/:key` serves `status = 'public'` rows only.

## 3. Email

Two features that share a tab and nothing else.

### Staff addresses

A director enters `ken@bmxc.camp` and a destination. The worker calls
the Cloudflare Email Routing API to create the destination address and
the routing rule.

Cloudflare emails the destination a verification link. That is their
anti-abuse control and cannot be skipped, so the panel lists every
address with its verification state — pending or verified. "Why am I
not getting mail" then has an answer on screen instead of in the
dashboard.

Routes live in `worker/routes/email.js`, following `shop.js`: Access,
then `requireArea`, then an **allowlist** of the exact Cloudflare API
operations that may be reached — list, create and delete rules and
destination addresses, nothing else. The zone id is fixed server-side
(`44fe4c68ed1014b250436a9d9b0c61b2`); no request names a zone. Writes
land in `audit_log`.

**The catch-all stays untouched.** It currently forwards everything to
one address, which is what keeps mail to an unknown address from
vanishing. The panel does not offer to change it.

**Credential.** The right one is a scoped token with
`Zone / Email Routing / Edit` on bmxc.camp, stored as
`EMAIL_ROUTING_TOKEN`. The deploy token is `zone: read` and cannot do
this. The Global API Key on this machine works and is what development
uses, but it reaches five accounts including ones belonging to other
people, so it is not what production should hold. Until the secret is
set the tab reports the service unavailable — the same shape as the
Store tab without `SHOP_ORIGIN`.

### Subscribers

A `subscribers` table and a form on the public site. Double opt-in:
signup writes `pending` with a token, one confirmation email goes out,
the link sets `confirmed`.

That confirmation is a transactional email — triggered by a user
action, sent to the person who acted — so Cloudflare Email Service is
the correct tool and sends it within policy. This is the piece that
must be automatic, because it has to fire the moment someone
subscribes.

**Announcements are not sent from the panel.** Cloudflare's FAQ:

> Email Service is intended only for transactional emails. We plan to
> support marketing emails and bulk sender tooling in the future.

There is no bulk tier to opt into and no published quota. The cost of
ignoring that is not a policy scolding: complaint rates from
announcement mail attach to `bmxc.camp`'s sending reputation, which is
the same reputation the confirmation emails depend on. Sending the
marketing mail through this path is what would break the transactional
mail.

So the panel gives a confirmed subscriber list, CSV export, and a
one-click unsubscribe link on every email. Announcements go out from
whatever tool the camp prefers. Sending a few times a year by hand is a
smaller cost than a domain that stops reaching inboxes.

If Cloudflare ships bulk tooling, the table is already shaped for it.
If in-panel sending is wanted sooner, that needs a provider which
permits bulk — a separate decision, not this spec.

Unsubscribe is a public route with a token. It never requires signing
in, and honours the request on one click.

## 4. Faces

`face-service/` is a Python service using InsightFace, binding to
loopback, with no authentication. It cannot run on Workers: native
inference and a ~280MB model. Deployment means a separate host — a
Cloudflare Container, Fly.io, a VM — behind a Worker proxy.

**Nothing is deployed in this phase.** What gets built is the surface
it will need, against a documented API, with the host as configuration.

**A `faces` permission.** A sixth area, added to `AREAS` in
`worker/auth/permissions.js` *and* to `permission-areas.js`. Both, and
the existing cross-check test covers it: `design` was once added to the
server and not the panel, which left it grantable over HTTP and
invisible to the person meant to grant it.

**`worker/routes/faces.js`**, on the `shop.js` pattern: Access,
`requireArea('faces')`, an allowlist of method and path pairs,
forwarding to `FACE_ORIGIN` with a server-side token, writes audited.
Until `FACE_ORIGIN` is set the tab reports unavailable.

### Consent is a gate on enrollment

Every camper must opt in. That requirement is only real if it is
enforced where identities are created, not where they are displayed.

A `campers` table carries `consent_at`. Ingest refuses to enroll a bib
whose camper has no consent recorded, and the refusal is reported the
way the pipeline's existing abstentions are — under Declined, with a
reason.

Filtering at display time would fail the requirement while looking like
it met it: the face templates would already have been built from a
child whose family never agreed. Declining to enroll means the
photograph is still a photograph and simply never becomes an identity.

**Retention.** A configurable window after which embeddings and tags
expire. The service already treats embeddings as a rebuildable cache
rather than an archive, so expiry costs a rebuild, not data.

Deleting a camper cascades to their identity, templates and tags —
`unenroll` already does this, which is what makes a family's deletion
request answerable.

### Photos only

Video needs frame extraction and the service has no code for it. This
phase defines a `POST /ingest-video` boundary and stops. Half-building
ffmpeg into a service that cannot yet be tested end to end would add
the one thing here that nobody could verify.

### What the numbers do and do not say

The face half is well evidenced: three datasets, ~166,000 pairs, zero
false accepts at the 0.42 threshold. The bib half was measured on RBNR
— triathlons and road races, flat printed numbers, adults.

Camp photographs are cross-country and mostly children: mud, layering,
bibs folded under jackets, packs at the start, and faces less well
represented in the model's training data than the adults those datasets
are full of.

`bib_pattern` defaults to `^\d{3}$`, which the config file itself calls
a guess. It is the single most effective guard against phantom
identities and must be set to the width the camp actually issues before
any real corpus is ingested.

Expect tuning. Do not treat first-run output as correct because it is
confident — the failure that produced eight identities from two runners
was confident too.

## Testing

Per area, matching what the repo already does:

- **Redesign** — browser verification at three widths, console clean.
- **Media** — album CRUD, upload rejection paths, video type
  acceptance, and the existing boundary tests extended to cover that
  private video is no more reachable than private photos.
- **Email** — the allowlist rejects operations outside it; the zone id
  cannot be influenced by a request; unsubscribe works unauthenticated
  and is idempotent; a subscriber cannot be confirmed with a wrong or
  reused token.
- **Faces** — `faces` present in both `AREAS` lists (the existing
  cross-check); the proxy rejects a non-allowlisted path; ingest
  refuses a camper without `consent_at`.

The consent test is the one that matters most. It is the difference
between a policy that holds and a policy that is written down.

## Sequence

Four phases, each with its own plan and its own approval:

1. Redesign — no schema change, no new permission.
2. Media — `albums`, `album_id`, video.
3. Email — `subscribers`, routing proxy, public form.
4. Faces — `faces` permission, `campers`, proxy. Nothing deployed.

## Open items

- Email Sending must be enabled on bmxc.camp before subscriber
  confirmations can send. Needed for phase 3.
- `EMAIL_ROUTING_TOKEN` must be created and set. Phase 3 builds and
  tests without it.
- A host for face-service is undecided. Phase 4 does not need it.
- The camp's real bib width is unknown. Needed before ingest, not
  before phase 4.
