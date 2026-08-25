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
Press `⌘E` to open it: every route becomes an artboard on a zoomable canvas,
and clicking an element lets you rewrite copy or restyle it.

**Who can open it.** Admins, and anyone holding the `design` permission —
a fifth grantable area next to blog/media/merch/campinfo, assigned in /admin.
It is its own column rather than a reuse of `campinfo` because vedit reaches
every page at once; granting it through campinfo would silently widen that
editor across merch and blog too. Locally it is always on.

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

**Two sources of truth.** On CMS-backed pages (merch, staff, blog) a vedit
override layers on top of the D1 value and wins. Edit copy in /admin; use the
editor when the presentation is what needs changing.

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
