# BMXC Site

Marketing site for Blue Mountain Cross Country Camp (est. 1969). React 19 +
Vite + React Router, deployed to Cloudflare Workers static assets.

**Live:** https://bmxc.camp · `npm run deploy` (or push to `main` — CI deploys)

## Content is sourced, not invented

Every fact comes from bluemountainxccamp.com. Do not write plausible-sounding
camp details, prices, or product names — they will be wrong. If a fact isn't
on their site, say so rather than filling the gap.

The camp publishes a **$15-40 range** for merch, never per-item prices. An
earlier version invented per-item figures and a "Top of the range" label; both
were removed. Don't reintroduce them.

Source pages: `/faq.html` (44 Qs), `/apparel.html` (real product photos — not
in their nav), `/registration.html`, `/staff.html`, `/guest-speakers.html`.

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

## Gotchas

- **Verify in a browser.** Most bugs here were invisible to a passing build:
  reveals stuck at `opacity: 0`, gradient text rendering transparent, collapsed
  word spacing, a carousel dot that never reached the last index.
- `background-clip: text` does not reach descendants. `SplitText` wraps each
  word in its own span, so gradients must target `.split-text__inner`.
- Don't add `key` to the Spotify iframe — it remounts and cold-boots the embed.
- Deploy token is `zone: read` only. DNS and zone settings need the Cloudflare
  dashboard.
