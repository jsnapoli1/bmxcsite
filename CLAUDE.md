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

The link sets two sessionStorage flags before navigating: `vedit:session`
("here to edit", lasts the tab, gates the permission probe) and `vedit:open`
("open now", consumed on arrival). They are separate because one flag doing
both jobs either reopens the editor on every navigation or revokes the button
after one page.

Without the session flag no permission request is made at all — visitors
shouldn't spend a round trip on a feature they can't open. That request uses
`redirect: 'manual'`, because Access answers an unauthenticated
`/api/admin/*` with a cross-origin 302 that otherwise fails CORS and logs two
red errors in every visitor's console.

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

FAQ questions are deliberately **not** wrapped: their only handle is
`${category.id}-${index}`, so an explicit id would look stable while silently
reattaching on reorder.

`SplitText` carries `data-vedit-ui`, which hides its word spans from the DOM
scanner. The scanner matches `span` and treats any childless element holding
text as its own node, so without it a headline arrived as a row of one-word
boxes — three spans deep per word. The whole line is the right unit to
rewrite anyway, and `SectionHeading` / `PageHeader` / the Hero each wrap
their `SplitText` in an `<Editable>` that addresses it. **A bare `SplitText`
with no wrapper is not editable at all** — wrap any new one.

**Two sources of truth.** On CMS-backed pages (merch, staff, blog) a vedit
override layers on top of the D1 value and wins. Edit copy in /admin; use the
editor when the presentation is what needs changing.

**Granting it.** The toggle is "Site design" in /admin → Users. The panel's
area list lives in `src/admin/lib/permission-areas.js` and is cross-checked
against the worker's `AREAS` by a test — `design` was once added to the
server, API and database but not the panel, leaving it grantable over HTTP
and invisible to the person meant to grant it.

**Security.** `enabled` only decides whether the UI opens — it protects nothing.
`requireArea('design')` plus the `authorize` callback in worker/routes/vedit.js
are what reject a write. Writes are recorded in `audit_log`; reads are not.

Pinned to `v0.4.0` in devDependencies, not tracking the default branch — a
deploy must not pick up an unreviewed editor. Since 0.4.0 `createVeditHandler`
throws without `authorize`; a test asserts that, so dropping the callback in a
refactor fails loudly instead of quietly opening the endpoint.

## Gotchas

- **Verify in a browser.** Most bugs here were invisible to a passing build:
  reveals stuck at `opacity: 0`, gradient text rendering transparent, collapsed
  word spacing, a carousel dot that never reached the last index.
- `background-clip: text` does not reach descendants. `SplitText` wraps each
  word in its own span, so gradients must target `.split-text__inner`.
- Don't add `key` to the Spotify iframe — it remounts and cold-boots the embed.
- Deploy token is `zone: read` only. DNS and zone settings need the Cloudflare
  dashboard.
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
