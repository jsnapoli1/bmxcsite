# BMXC Site

Marketing site for [Blue Mountain Cross Country Camp](https://bmxc.camp),
the oldest and longest running XC summer camp in the Northeast (est. 1969).

React 19 + Vite + React Router, deployed to Cloudflare Workers static assets.

**Live:** https://bmxc.camp

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build to `dist/`
- `npm run deploy` — build and deploy to Cloudflare Workers

## Deployment

Pushes to `main` deploy automatically via
`.github/workflows/deploy-cloudflare.yml`, which needs a `CLOUDFLARE_API_TOKEN`
repo secret. Custom domains (`bmxc.camp`, `www.bmxc.camp`) are declared in
`wrangler.jsonc` so CI preserves them.

`.github/workflows/deploy.yml` still publishes to GitHub Pages on the same
push. It is kept working via a conditional Vite `base` path
(`DEPLOY_TARGET=gh-pages`). Delete that workflow if only Cloudflare is wanted.

## Structure

```
src/
├── data/        all user-facing copy, sourced from bluemountainxccamp.com
├── pages/       one component + stylesheet per route
├── components/  hero, layout, motion, ui
├── styles/      design tokens and global styles
└── hooks/       useInView, useReducedMotion
```

## Contributing

Read `CLAUDE.md` first. Content is sourced rather than written — do not invent
camp facts, prices, or product names. Design and voice constraints are
documented there and in `src/data/` and `src/styles/`.
