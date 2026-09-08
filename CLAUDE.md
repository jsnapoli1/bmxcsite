# BMXC Site

Marketing site for Blue Mountain Cross Country Camp (est. 1969). React 19 +
Vite + React Router, deployed to Cloudflare Workers static assets.

**Live:** https://bmxc.camp · `npm run deploy` (or push to `main` — CI deploys)

## Voice

Theirs is plain and direct: *"Your best finish starts with us!"*,
*"Color: Royal Blue (pictured)"*, *"* No pre-orders or reservations"*.

Avoid: em-dash aphorisms ending on earned wisdom, rule-of-three lists,
headings that dodge the noun ("The people you keep"), "X, not Y" antithesis.
These read as AI-generated and were stripped once already.

Em-dashes inside quoted FAQ answers are intentional — those are the camp's own
sentences. Don't rewrite them to hit a metric.

## Design direction: Field Guide

Set like a team handbook: reference-dense, plainly typeset, information as the
ornament. Serif display (Source Serif 4), warm paper surfaces, **no shadows**,
radii 2-6px, structure from rules and weight. Ruled numbered entries, not
floating cards.

Palette is sampled from the camp's own logo: navy `#183060`, gold `#c09018`,
green `#306030`, ink `#1c1a17`. Not invented.

Banned (removed once, don't return): uppercase headings, gradient-filled text,
decorative gradients, animated stripes, hover lifts, pill buttons.

## Photography

Only `camp-group.jpg` (the whole-camp panorama) is used at size. The other
camp photos are better shots but show **individually identifiable minors** —
not appropriate at hero scale on a site about kids. Keep photography small and
documentary.

## Visual editor (vedit)

[vedit](https://github.com/jsnapoli1/vedit) is wired in as the design surface.
Click **Edit page** (bottom-right, visible only with the `design` permission)
to open it: every route becomes an artboard on a zoomable canvas, and
clicking an element lets you rewrite copy or restyle it.

A button rather than a keyboard shortcut, because no chord was safe. vedit
binds `⌘E` with no prop to rebind it; Chromium takes `⌘E` for the extensions
menu; Arc takes both `⌘⇧E` and `⌃⇧E` for Easel. `⌘⇧E` is still bound as a
convenience for browsers that leave it alone, but it is never the only way in.

**Don't test a keyboard shortcut through the DevTools protocol.** Injected
keystrokes go straight to the page and bypass browser-level bindings, so a
chord the browser reserves tests clean and fails in someone's hands. Two
shortcuts shipped that way before a button replaced them.

The artboards are same-origin iframes running this same app, so a keystroke
inside one never reaches the top window; a framed copy relays the chord
upward rather than toggling its own React tree, and renders no button of its
own.

**Who can open it.** Admins, and anyone holding the `design` permission —
a fifth grantable area next to blog/media/merch/campinfo, assigned in /admin.
It is its own column rather than a reuse of `campinfo` because vedit reaches
every page at once; granting it through campinfo would silently widen that
editor across merch and blog too. Locally it is always on.

**Getting in.** /admin → **Site design** lists every page; clicking one opens
it in the editor. That is the only entry point — /admin is already behind
Cloudflare Access, so the door is the sign-in you already have, and there is
no URL to remember or share.

The link carries `?edit=1` **and** sets two sessionStorage flags:
`vedit:session` ("here to edit", lasts the tab, gates the permission probe)
and `vedit:open` ("open now", consumed on arrival). The flags are separate
because one doing both jobs either reopens the editor on every navigation or
revokes the button after one page.

Two signals rather than one because the flags depend on a storage write
landing before the browser navigates away, and on storage being available at
all. `?edit=1` survives regardless and is stripped from the URL once read.
Neither signal grants anything — the permission check behind them is what
decides.

**"editing = true" but no editor** means vedit's editor-UI chunk failed to
load. `EditorHost` (chunk-TTKFO6QU) fetches it with a bare
`void import(...).then(...)` and no `.catch()`, so a failed import rejects
unhandled, its `Editor` state stays null, and it renders null forever while
`editing` stays true — invisible from outside. The provider listens for that
rejection and says so; the usual cause is a cached page asking for a chunk
hash a later deploy replaced, and a hard reload fixes it.

**If the editor doesn't open, read the console.** Every branch of the check
reports through `[vedit] …`: no session flag, signed out (Access redirect),
a status code, a missing permission, or a network error. Without those the
failure modes are indistinguishable from outside — all of them present as
"no button", which is why diagnosing this once took several rounds.

Without the session flag no permission request is made at all — visitors
shouldn't spend a round trip on a feature they can't open. That request uses
`redirect: 'manual'`, because Access answers an unauthenticated
`/api/admin/*` with a cross-origin 302 that otherwise fails CORS and logs two
red errors in every visitor's console.

**Six pages are composed, six are not.** Home, Camp, Registration, Contact,
Playlists and Videos render entirely from their document: every section is a
placed component, so it can be reordered, removed, or added to from the
editor. Merch, Staff, FAQ, Blog and BlogPost are deliberately *not* — their
content comes from D1 via /admin, and a slot there would be a third place to
change the same page. Register is the sixth, for a different reason.

**/register is editable but not composed.** Every authored string on the
registration form is wrapped in an `<Editable>`, so its wording can be
changed like anywhere else; it has no `<VeditSlot>`. The four steps share
`step`, `fields` and `quote`, and their order *is* the flow — a movable
payment step would be a way to break checkout from a design tool. It is
therefore in `EDITABLE_PAGES` but not in the seed's `PAGE_LAYOUTS`, which
the seed test allows (it asserts seeded ⊆ editable, not the reverse).

A test reads the `<Route>` list out of App.jsx and requires every concrete
route to appear in `EDITABLE_PAGES`. `/register` was served for months while
absent from that list, so its "Pay $250 deposit" button could not be selected
at all — an omission invisible from the page itself.

**Embeds.** `Embed` (Elements group) takes a pasted YouTube, Spotify or
Google Maps link. The URL is a trust boundary and is never passed through:
`src/lib/embed.js` matches it against a fixed provider list, extracts an id,
validates it, and **rebuilds** the embed URL from a literal template. An
editor field reaching an `iframe src` unfiltered would let the `design`
permission serve arbitrary content from bmxc.camp — a look-alike payment
page, a `javascript:` URL — which is a much larger thing than changing how a
page looks. Anything unmatched renders a message instead of an empty band.
Adding a provider means adding a matcher there, not relaxing the check.

The registry is `src/lib/vedit-components.js`; the sections it lists live in
`src/components/sections/`. Everything is registered `wrap: false`, because
these are full-width `<section>`s whose own class carries the padding — vedit's
default wrapper `<div>` breaks that, and only the unwrapped path passes the
placement id through as a prop.

**The registry must be passed to both providers.** The editor is where
components are *placed*; the reader is where they are *rendered*. A reader
without it draws vedit's "isn't registered on this page" placeholder, so every
visitor sees an orange warning box where each section should be.

**Seeding.** `node scripts/seed-vedit-pages.js --local|--remote` writes each
page's starting layout. Without it a composed page falls back to the children
in its `<VeditSlot>` — correct for a visitor, but nothing is movable, because
vedit only renders the fallback while the slot is empty. Re-running overwrites
whatever is there, so it is a migration step, not a routine one.

The seed stores **no rendered copy** — only which page a masthead belongs to.
Several leads interpolate live data (session dates, venue, directors), and a
frozen string would go stale the day the session moves. A test enforces this.

**Save vs. publish.** Saving writes a `draft`; visitors keep seeing the
`published` stage until someone presses Publish. Every publish also appends to
`vedit_versions`, which is what fills the History panel. `/api/vedit` (public,
no token) names the `published` stage itself, so no query string can coax a
draft out of it.

**Local setup.** Run `npx wrangler dev --port 8788` alongside `npm run dev` —
vite.config.js proxies `/api` and `/media` to it. Without the worker running,
the editor loads but cannot save.

**Ids.** Explicit `<Editable id="...">` ids are keyed on stable fields
(`merch.item.${item.id}`, `staff.member.${member.name}`, `blog.post.${slug}`),
never loop position — reordering the catalogue in /admin must not slide one
item's override onto another product. `SectionHeading` and `PageHeader` take an
`id` prop, so a page opts its headings in with one prop instead of a wrapper per
call site. Anything unwrapped falls back to the DOM scanner, whose positional
ids (`auto:#root>section>h1`) break when the markup moves.

FAQ questions carry an explicit `id`, minted once when the question is
created. `${category.id}-${index}` was the problem: /admin offers a reorder
control, so a position-derived id slid a question's override onto its
neighbour the first time anyone moved one. `src/lib/faq-ids.js` mints ids and
fills them in on read, since a D1 document is only rewritten when someone
saves. Keep that module free of React and editor imports — the admin panel
imports it, and the reason `visual-editor-pages.js` exists applies here too.

`SplitText`'s word spans are excluded from the scanner by the `autoSelector`
passed to VeditProvider, not by `data-vedit-ui`. The scanner matches `span`
and treats any childless element holding text as its own node, so without the
exclusion a headline arrives as a row of one-word boxes, three spans deep per
word.

**`data-vedit-ui` is the wrong tool here.** It means "this is editor chrome,
ignore clicks entirely", and vedit tests it with `closest()` — so marking the
words made every heading on the site unselectable: a click landed on a word,
the ancestor test matched, and the lookup returned null before reaching the
`<Editable>` wrapping the line.

The title wrappers use `display: block`, not `display: contents`. Contents
generates no box, so vedit could resolve the heading from a click but had
nothing to outline or select. Block keeps the layout identical, since the
SplitText inside is already a block.

The whole line is the right unit to rewrite, and `SectionHeading` /
`PageHeader` / the Hero each wrap their `SplitText` in an `<Editable>` that
addresses it. **A bare `SplitText` with no wrapper is not editable at all** —
wrap any new one.

**The Registration page's own copy is editable, prices included.** Tier
names and windows are keyed on `tier.name`, bus regions on `route.region`,
key dates on `entry.label` — never loop position, so inserting a tier cannot
slide one window's override onto another card. The deposit figure and its
"Deposit" caption are separate handles: before this they had no id of their
own, so clicking "$250 Deposit" selected the entire pricing section.

**Every list that reads as prose carries ids in its data.** `PACKING_LIST`,
`PAYMENT_NOTES`, `FINE_PRINT`, `MERCH_CAVEATS`, `STAFF_CREDENTIALS` and the
FAQ questions are all `{ id, text }` (or `{ id, q, a }`), and each entry is
wrapped and keyed on its own id.

These were unwrapped for years because their only handle was the string
itself (`key={note}`) — an id built from the text reattaches to a different
row the moment someone rewords one, which is exactly what editing them is
for. That is a reason to fix the data, not to leave the copy uneditable.

**The ids are load-bearing.** Rewording an entry keeps its override;
*changing* an `id` orphans that override, and reusing one moves another
entry's edit onto that row. `test/lib/editable-list-ids.test.js` pins it:
every entry has an id and text, no id repeats, ids are plain slugs, and the
FAQ migration fills gaps without touching text.

**What is still deliberately not editable, site-wide:**

- **Prices anything also charges**: `tier.price`, `route.price`, and the
  OpenShop store figures. A retypable number would be a second, disagreeing
  answer, which is the one thing these pages must not have. The deposit *is*
  a template (`{deposit}`) because the number stays live from
  `src/data/registration.js` either way.
- **The blog's fetch-failure message.** It renders only when the API is
  down; an `<Editable>` in an error path is a liability, not a feature. The
  blog's *empty* state is wrapped — that is a normal state, not an error.
- **Derived thumbnails.** The two YouTube posters take their `src` from the
  video's own id, so a swappable source would let the poster disagree with
  the video it plays.
- **Decoration**: counter numerals, arrows, and `SplitText`'s word spans.
- **Landmark names.** The `aria-label` on each `<nav>` ("Main navigation",
  "Footer navigation", "FAQ categories"), the `<ol>` of registration steps,
  and the brand link's "Blue Mountain XC Camp — home". These name a region so
  a screen reader can jump to it; they are never read as prose, and a
  renamed landmark is a worse page, not a redesigned one.

**Attributes are content too, and were audited separately.** An `alt` or an
`aria-label` is what a screen reader announces, and a text-only sweep never
looks at one. Product `alt` text is editable through `EditableImage`, which
sets `kind="image"` and gives the inspector an Alt field. The carousel's
control names needed `useEditable` instead — see `Carousel.jsx`, since
`<Editable>` cannot wrap an attribute.

Everything else on every page resolves to itself. When adding a section,
check the value *beside* a wrapped label too — the recurring mistake is
wrapping "Venue" and leaving "Camp Westmont" addressable only as its `<ul>`.

**Pass `label` to anything that repeats.** vedit names a layer from the id's
last segment, so 26 nav and footer links all read "Label" and ten schedule
rows all read "time" — the layers panel was unusable for finding anything.
`label={item.text}` gives each row its own name.

`<Editable>` takes `id` for its own node id and cannot also carry a DOM id.
Where a heading is the target of `aria-labelledby`, the `<h2>` keeps the DOM
id and the `<Editable>` wraps the text inside it.

**Two sources of truth.** On CMS-backed pages (merch, staff, blog) a vedit
override layers on top of the D1 value and wins. Edit copy in /admin; use the
editor when the presentation is what needs changing.

**Granting it.** The toggle is "Site design" in /admin → Users. The panel's
area list lives in `src/admin/lib/permission-areas.js` and is cross-checked
against the worker's `AREAS` by a test — `design` was once added to the
server, API and database but not the panel, leaving it grantable over HTTP
and invisible to the person meant to grant it.

**`enabled` is required on the editor provider.** vedit renders its editor UI
only when `isEnabled` is true, and `isEnabled = enabled ?? defaultEnabled()`.
That fallback is true on localhost, in a `NODE_ENV=development` build, or with
`?vedit=1` — none of which hold on bmxc.camp. Omitting the prop passed every
local test and rendered nothing in production, while `useVeditEditing` kept
reporting `editing = true` because it only writes to the store.

**Test the editor against a non-localhost hostname.** `lvh.me` resolves to
127.0.0.1 but does not match vedit's `LOCAL_HOSTS`, so it reproduces
production's `defaultEnabled() === false`. Every earlier test used
`localhost`, which took the other branch and hid this for several rounds.

**Security.** `enabled` only decides whether the UI opens — it protects nothing.
`requireArea('design')` plus the `authorize` callback in worker/routes/vedit.js
are what reject a write. Writes are recorded in `audit_log`; reads are not.

Pinned to `v0.5.0` in devDependencies, not tracking the default branch — a
deploy must not pick up an unreviewed editor. Since 0.4.0 `createVeditHandler`
throws without `authorize`; a test asserts that, so dropping the callback in a
refactor fails loudly instead of quietly opening the endpoint.

**Live values interpolate; they are never stored.** An `<Editable>` takes
`vars`, and its text is a template — `Pay {deposit} deposit`, `cover for
{insurance}`. The override saves the template, the host substitutes on every
render. A rewritten sentence therefore keeps quoting the current price, and a
frozen `$250` can never come to disagree with what Stripe charges. An unknown
name renders literally rather than blanking, and the inspector names it —
otherwise a typo like `{insurnace}` ships looking deliberate.

**The inspector's trash removes; the undo arrow reverts.** They used to be one
trash icon that deleted an inserted node but merely reset overrides on anything
from source code — so on an unedited element the obvious delete control did
nothing, silently. Removing a source element writes `hidden` (`display:none`
for visitors, dimmed and outlined in the editor), matching what Delete and
Backspace already did.

## Merch store (OpenShop)

The online store is [OpenShop](https://github.com/AJFrio/OpenShop), deployed as
its **own worker** with its own KV and Stripe keys. This site calls its HTTP
API; it is not vendored here.

**That separation is a licence requirement, not a preference.** OpenShop is
AGPL-3.0. Copying its source into this repo would put the whole site under
AGPL, including an obligation to offer source to anyone who uses it over a
network. Calling a separate service does not. Do not vendor it.

**Auth is bridged, not shared.** OpenShop authenticates with one shared admin
password exchanged for a 24h token. This site uses Cloudflare Access with
per-person D1 permissions. `worker/routes/shop.js` verifies Access and the
`merch` permission, then forwards with a server-side credential — so there is
one sign-in, the password never reaches a browser, and store writes land in
`audit_log` against a real person. On OpenShop's own side every change looks
identical no matter who made it.

**The proxy is an allowlist.** OpenShop's admin API also exposes store
settings, media, AI image generation and an agent endpoint. None of those
belong to the `merch` permission, so `ALLOWED` in shop.js names the exact
method+path pairs that pass. Adding a capability should be deliberate, not a
side effect of OpenShop shipping a route.

**Two tabs, on purpose.** *Merch* edits the informational merch page in D1
(cash only, sold at camp) — still what the public site shows. *Store* is the
catalogue behind it. They share the `merch` permission.

Needs `SHOP_ORIGIN` and `SHOP_ADMIN_PASSWORD`. Until both are set the Store
tab reports the store is unavailable; nothing else is affected.

**`/merch` redirects to the store only when the store has products** — see
the handler in `worker/app.js`. While the catalogue is empty it serves the
existing cash-only page, which is still accurate. Adding the first product
starts the redirect on its own, within a minute.

**The store cannot be stocked without Stripe.** Creating a product syncs to
Stripe before writing to KV, so with no `STRIPE_SECRET_KEY` it fails with
`Neither apiKey nor config.authenticator provided`. That means no products,
so no redirect, so `/merch` stays as it is until real keys are added.

## Admin panel

Seven grantable areas: blog, media, merch, campinfo, design, faces,
registrations. The list lives in `worker/auth/permissions.js` and is mirrored with labels in
`src/admin/lib/permission-areas.js`; a test cross-checks both directions.

**`worker/routes/users.js` derives its columns from `AREAS`.** It used to
enumerate them in five places — `toFlags`, the INSERT, the UPDATE, the
PATCH merge and the list response — and `faces` was added to the schema
and the permission module while all five still listed only the first
five. The API accepted the grant and persisted it nowhere. Keep it
derived; a seventh area must not need five edits.

The panel is responsive: a sidebar above 48rem, a drawer below it, and
tables that stack into labelled rows. Every `<td>` in an `.admin-table`
carries `data-label` matching its column header — that is what the
stacked layout reads.

**`admin.css` was split** into `src/admin/styles/{shell,controls,tables,
pages}.css`. The panel does not import `global.css` (that carries the
public site's base typography), so `shell.css` restates the
`box-sizing: border-box` reset. Without it, anything with an explicit
width plus a border overflows its grid track.

**The panel is its own HTML entry point, so it must load the fonts
itself.** `admin.html` linked no stylesheet at all while `tokens.css`
asked for Source Serif 4, Inter and JetBrains Mono — so every rule
silently resolved to its fallback and the whole panel rendered in Iowan
Old Style and Times. Nothing failed: the build passed, the tokens were
correct, and the CSS was the same CSS the public site uses. It simply
looked a decade older than bmxc.camp, and the cause was invisible in
every file except the one that had no font link in it. `admin-preview.html`
loads the same fonts, or the preview is not a picture of the panel.

**The masthead is the panel's one dark band**, carrying the camp's mark
and wordmark like the public navbar, closed by the gold rule. It renders
on all four paths — loading, access error, no-permissions and the panel
itself — via the `Masthead` component, so a director who cannot sign in
still lands on something that looks like this site.

**`admin-preview.html` is gitignored and local only.** The panel needs a
Cloudflare Access JWT that does not exist on localhost, so
`/api/admin/me` answers 403 and the real entry point renders only its
error state. The preview stubs the reads so layout can be checked; it
stubs nothing that writes, and `vite.admin.config.js` names a single
`admin.html` input so it cannot ship.

## Email

**Email Routing is live on bmxc.camp; Email Sending is not.** The
subscribe flow writes the row and issues the token but sends nothing
until `wrangler email sending enable bmxc.camp` is done.

**Announcements are not sendable from the panel, on purpose.** Cloudflare
Email Service is transactional-only by their own FAQ — there is no bulk
tier to opt into. The double opt-in confirmation is transactional and
belongs there; a broadcast does not, and would put the sending
reputation those confirmations depend on at risk. The panel exports CSV
instead.

`worker/email/routing-client.js` is the allowlist: five operations, no
passthrough. The zone id is fixed in the file so no request can point a
write at another zone. Destinations are **account**-scoped and shared by
every zone on the account, which is why nothing deletes one — it could
break routing on an unrelated domain. `listRules` filters the catch-all
out; it is what stops mail to an unknown address vanishing.

Needs `CF_API_TOKEN` (a secret: `Zone / Email Routing / Edit` on
bmxc.camp plus `Account / Email Routing Addresses / Edit`). The deploy
token is `zone: read` and cannot do this.

## Face tagging

`face-service/` is Python with a ~280MB InsightFace model. It **cannot
run on Workers** and is not deployed. This repo holds the surface it will
need: the `faces` permission, the `campers` roster, and
`worker/routes/faces.js` — an allowlisted proxy on the `shop.js` pattern.
Without `FACE_ORIGIN` the proxied routes answer 503 while the roster
still works.

**Consent gates enrollment, not display.** Every camper must opt in.
`campers.consent_at` defaults to NULL, and `consentedRoster()` is the
only roster the service is ever sent — a bib without consent is not
merely un-enrolled, the service is never told the name exists. `/ingest`
refuses outright on an empty consenting roster rather than making a pass
over children's faces that can produce no legitimate result.

Filtering at display time would meet the requirement in appearance only:
the face templates would already have been built.

**Before any real ingest, set `bib_pattern`** in
`face-service/config.toml` to the width the camp actually issues. The
default `^\d{3}$` is a guess, and OCR fragments ('51' from 516) each
mint their own phantom identity — that failure once turned two runners
into eight identities. The face half is well evidenced (~166,000 pairs,
zero false accepts); the bib half was measured on adult road races, and
cross-country with children is harder.

## Registration

Custom, replacing the old site's handoff to **CampNetwork**
(`portal.campnetwork.com/Register/Register.php?camp_id=398522`, camp_id
398522 — still live, and the fallback until this is trusted).

Four steps at `/register`, each saved before advancing, the reference
kept in sessionStorage so a reload resumes. `src/lib/pricing.js` is the
one place money is decided: integer cents, dates compared in **UTC** so a
tier boundary cannot shift with the timezone the worker runs in.

**The client never sets a price.** `repository.js` drops `status`,
`total_cents` and `deposit_paid_cents` from any draft write, and the
server recomputes the quote when creating the Checkout session. Three
tests pin it.

**Only the Stripe webhook confirms a registration.** Signature verified
against the raw bytes (a re-serialised object is not the signed
payload), constant-time compared, timestamped against replay, and
idempotent via `UNIQUE(stripe_session_id)` — Stripe retries until
acknowledged. An event naming an unknown reference is acknowledged, not
errored, or Stripe retries forever.

`quote()` returns **null outside Jan 1 – Jun 30**, and the API passes
that through as `registrationOpen: false` rather than inventing a tier.
Tests pin the clock with fake timers; without that they pass only half
the year.

Confirming writes a `campers` row with a `reg-<reference>` placeholder
bib, carrying photo consent exactly as the guardian gave it. A director
renames the bib in Face tagging once numbers are handed out.

Needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Without them
checkout answers 503 and the page says so; drafts still save.

**Health data is not stored yet, and HIPAA is not the reason.** An
earlier version of this file said Cloudflare's Enterprise-only BAA
blocked it. That was wrong: HIPAA binds covered entities — health plans,
clearinghouses, and providers billing insurance electronically — and a
camp collecting forms from parents is none of those. PA (camp is in
Poyntelle) regulates camps for sanitation only, with no health-record
requirements; NY's 10 NYCRR 7-2.8 would apply had the camp been located
there. What does apply is PA's breach-notification act, where
**encryption is the safe harbour** — which argues for encrypting the
registration data already stored, not just future health fields.

## Gotchas

- **Verify in a browser.** Most bugs here were invisible to a passing build:
  reveals stuck at `opacity: 0`, gradient text rendering transparent, collapsed
  word spacing, a carousel dot that never reached the last index.
- `background-clip: text` does not reach descendants. `SplitText` wraps each
  word in its own span, so gradients must target `.split-text__inner`.
- Don't add `key` to the Spotify iframe — it remounts and cold-boots the embed.
- Deploy token is `zone: read` only. DNS and zone settings need the Cloudflare
  dashboard.
- Every HTML entry point needs a `must-revalidate` rule in `public/_headers`.
  `/admin` and `/admin.html` were once missing one, so an admin kept running
  the previous deploy's panel bundle while the public site updated normally —
  the HTML names the hashed assets, and those are `immutable`, so nothing
  downstream ever corrects a stale copy.
- `src/lib/visual-editor-pages.js` exists so the admin panel can import the
  route list and handoff flags without pulling in the editor. Rollup follows
  the lazy `import('./visual-editor-provider.jsx')` in visual-editor.jsx even
  from code that can never reach it, which put an editor chunk in the admin
  bundle. Keep that module free of React and editor imports.
- `<Editable>` throws outside a `VeditProvider`. The provider must therefore
  never sit behind a Suspense boundary that renders the page as its fallback —
  doing so blanked the whole site with "Vedit components must be rendered
  inside <VeditProvider>" while the build stayed green.
- vedit publishes with `?action=publish` on a PUT, not `?stage=published`.
  `stage` is read only by GET, so a publish written the wrong way answers
  `200 {"ok":true}` and silently saves a draft.
- The editor's title wrappers use `display: contents` (section-heading.css,
  page-header.css) so `SplitText` stays a direct flex child. A styleable
  wrapper there would break the heading layout — and `display: contents`
  paints nothing, so style overrides belong on the title, not the wrapper.
