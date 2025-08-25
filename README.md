# BMXC Site Github Page

This repository contains a basic React application built with Vite. It includes five pages: Home, Music, Media, Merch, and About.

## Deployment

The project is set up for GitHub Pages. The `vite.config.js` file defines a base path so assets resolve correctly, and the workflow in `.github/workflows/deploy.yml` builds the app and publishes the `dist` folder. During deployment, `index.html` is copied to `404.html` to preserve client-side routing.

## Available Scripts

- `npm run dev` – start the development server.
- `npm run build` – build the app for production.
- `npm test` – run placeholder tests.
