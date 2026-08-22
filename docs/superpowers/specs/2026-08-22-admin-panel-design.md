# BMXC Admin Panel — Design

**Date:** 2026-08-22
**Status:** Approved for phases 1–4. Phase 5 (webmail) deferred.

## Problem

Every piece of content on bmxc.camp lives in hardcoded JavaScript modules
(`src/data/*.js`). Changing a staff bio, a FAQ answer, or a merch price
requires editing code and running a deploy. The camp directors cannot do
this. The site also has no blog, no way to upload photos, and no email
addresses on its own domain.

This design adds an admin panel that lets non-technical staff manage
content, and puts real email on `bmxc.camp`.

## Scope

**In scope (phases 1–4):**

- Authenticated admin panel at `/admin`
- Per-area permissions: blog, media, merch, camp info
- Database-backed content with a draft → publish step
- Private-by-default photo and video uploads
- A blog, which does not exist on the site today
- Email addresses on `bmxc.camp`, forwarding to Gmail
- A forwarding-rules table in the panel

**Out of scope (phase 5, deferred):**

- Reading, composing, or replying to mail inside the panel
- Any mailbox UI

**Explicitly untouched:**

- `bluemountainxccamp.com` and the directors' live iPage mailbox. This is
  production email for real people who are not party to this project.

## Constraints

Discovered during design, all verified:

| Fact | Consequence |
|---|---|
| `bmxc.camp` is already on Cloudflare DNS (`emma`/`cris.ns.cloudflare.com`) | No nameserver migration needed |
| `bmxc.camp` MX currently points at Namecheap forwarding | Cutover replaces it; user confirmed nothing real depends on it |
| `bluemountainxccamp.com` MX points at `mx.ipage.com` | Live mailbox. Do not touch |
| No DMARC record on `bmxc.camp` | Add one during phase 4 |
| Email Sending is public beta, Workers **Paid** only | $5/mo, per *account* not per domain; account already has other Workers |
| Outbound: 3,000 emails/month included, then $0.35/1,000 | Per account, shared across projects |
| Email Routing inbound: free, unlimited, 25 MiB max | Sufficient |
| Cloudflare requires destination addresses to be **verified** by clicking an emailed link | Panel must show pending state, not fail silently |
| Two deploy workflows exist (Workers + GitHub Pages) | Pages cannot run server code; retire it |
| Camp photos show identifiable minors | Uploads private by default, explicit publish |

## Architecture

One Worker with two entry points, replacing today's assets-only config.

```
                    ┌──────────────────────────────┐
   visitor ────────▶│  fetch()                      │
                    │   /           → public site   │──▶ KV (cached content)
                    │   /api/*      → JSON API      │──▶ D1
   staff ──────────▶│   /admin      → panel (Access)│──▶ D1 + R2
                    │                               │
   inbound mail ───▶│  email()                      │──▶ forward to Gmail
                    └──────────────────────────────┘
```

**Storage:**

- **D1** — content (blog, staff, FAQ, merch, camp info), users, permissions,
  media metadata, forwarding rules, audit log
- **R2** — uploaded media. Two prefixes: `private/` and `public/`
- **KV** — rendered public content, cached; purged on publish

**Why KV in front of D1:** the site is currently a fast static bundle.
Reading D1 on every page view would regress both latency and cost. Publishing
writes D1 then purges KV; visitors read KV. D1 reads stay near zero.

### Auth

Cloudflare Access guards `/admin` and `/api/admin/*`. It issues a signed JWT
which the Worker verifies against Cloudflare's public keys on every request.
Access establishes *identity*; it does not establish *authorization*.

Authorization lives in our own `users` table, keyed on the verified email
claim from the JWT. This resolves the tension between "use Access" and "invite
people in my panel": Access answers *is this really you*, the panel answers
*what may you do*.

```
Request → Access (is this a known human?) → JWT
       → Worker verifies JWT signature
       → look up users.email → permission flags
       → allow or deny per content area
```

Adding a person is two steps today: add to Access (dashboard), set permissions
(panel). The panel surfaces this clearly rather than hiding it. Automating the
Access side via API is possible later; not in this scope.

**Permission model:** four independent boolean flags per user —
`can_blog`, `can_media`, `can_merch`, `can_campinfo`. Plus `is_admin`, which
grants user management. Deliberately flat. No role hierarchy, no inheritance:
a camp with six staff does not need RBAC, and flat flags are auditable at a
glance.

### Content model

Existing data is not flat. `STAFF_GROUPS` nests members inside ordered groups;
`FAQ_CATEGORIES` nests items inside ordered categories. The schema preserves
this — group tables with `sort_order`, item tables with a foreign key and their
own `sort_order`. The editor must support reordering, not just editing.

Every content row carries `status` (`draft` | `published`), `updated_at`, and
`updated_by`. Publishing is an explicit action, separate from saving.

### Media

Upload → `private/` prefix in R2, row in `media` table, `status = private`.
Nothing in the public site can reference it. Publishing copies the object to
`public/` and flips status. Unpublishing reverses it.

Images are resized on upload; originals retained in `private/`. Videos are
YouTube links, consistent with the existing `videos.js` model — hosting video
on R2 is expensive and slow, and the camp already has a YouTube channel.

### Email (phase 4)

Inbound forwarding is the core deliverable. Outbound is used only for system
notifications (e.g. "someone submitted the contact form"), never for
correspondence with parents.

Inbound forwarding works on the free plan. Outbound requires Workers Paid.
If Paid is not active on the account, phase 4 still ships — forwarding,
addresses, and the rules table all work; only the notification emails are
disabled, behind a single config flag. Nothing else in the phase depends on
outbound.

```
mail to *@bmxc.camp
  → Cloudflare Email Routing (MX)
  → rule match
  → forward to verified Gmail destination
```

Addresses created: `ken@`, `sarah@`, `info@`, plus a catch-all.
Each destination requires the owner to click a verification link before
forwarding works. The panel's rules table shows `pending` vs `verified` per
destination.

The public contact address changes from `directors@bluemountainxccamp.com` to
`info@bmxc.camp`. **This routes real parent email through the new system**, so
it ships only after forwarding is confirmed working end to end — verified
destination plus a received test message. It is not part of the MX cutover
commit.

DMARC (`p=none` initially), SPF, and DKIM records are added during onboarding.

## Phases

Each phase is independently shippable and leaves the site working. Each gets
its own implementation plan when it starts — this spec is the shared design,
not a single plan for all four.

**Phase 1 — Foundation**
Worker gains a `fetch` handler; site still serves identically. D1 created with
schema. Access configured. Admin shell with login, user list, permission
toggles. Retire the GitHub Pages workflow. *Ships: nothing user-visible
changes; staff can log in and see an empty panel.*

**Phase 2 — CMS**
Migrate `src/data/*.js` into D1, preserving grouping and order. Editors for
staff, FAQ, camp info, merch. Draft → publish.

Public pages are cut over from the bundled JS modules to KV one area at a
time (staff, then FAQ, then merch, then camp info), so a problem with any
one migration affects a single page rather than the whole site. The old
`src/data/*.js` modules remain in git until every area is cut over and
verified in a browser.
*Ships: directors can edit real content and see it live.*

**Phase 3 — Media & blog**
R2 uploads, private by default, resizing. Blog: schema, editor, public index
and post pages designed in the Field Guide direction. *Ships: staff can post.*

**Phase 4 — Email**
Onboard `bmxc.camp` to Email Service. MX cutover (destructive; gated on
explicit go-ahead). Forwarding-rules table in the panel. Contact-form
notifications. Public contact address switched last, after verification.
*Ships: real addresses on the camp's own domain.*

**Phase 5 — Webmail. Deferred.**
Not designed here. Recorded for context: Roundcube, SnappyMail, and RainLoop
are PHP + IMAP and cannot run on Workers. Stalwart cannot either — Workers
accepts no inbound TCP, so a mail server has nothing to listen on. Viable
Workers-native references exist (`maillab/cloud-mail`, MIT, actively
maintained) if this is revisited.

## Testing

- **Unit** — permission checks, content transforms, MIME parsing
- **Integration** — API endpoints against a local D1; auth rejection paths
- **E2E (Playwright)** — login, edit, publish, verify on public site;
  upload stays private until published
- **Visual regression** — 320/768/1024/1440 on new blog pages, per web rules
- **Manual, required before phase 4 DNS change** — send a test message to each
  new address and confirm arrival in Gmail

Auth denial paths get tests before features. A permission bug exposes the
ability to publish a child's photograph.

## Risks

| Risk | Mitigation |
|---|---|
| MX cutover breaks existing forwarding | User confirmed nothing real uses it; cutover is its own commit, reversible by restoring MX records |
| Real parent mail flows through new system | Public address switched only after verified end-to-end test |
| Static → dynamic regresses performance | KV cache in front of D1; public pages never hit D1 |
| Media permission bug exposes minors | Private by default; publish is explicit; denial paths tested first |
| Email Sending is beta | Used only for notifications in 1–4, never for correspondence. Site works if it fails |
| Content migration loses data | `src/data/*.js` stays in git; migration is additive and re-runnable |

## Open items

- Whether to automate Cloudflare Access user creation via API (deferred)
- Blog visual design needs its own pass against the Field Guide direction
- Whether directors eventually migrate off iPage (explicitly out of scope)
