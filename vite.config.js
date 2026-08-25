import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],

  // Forward API calls to `wrangler dev` so the visual editor can load and
  // save against the real worker during `npm run dev`. Without this, Vite
  // answers /api/* with the SPA fallback (index.html) and the editor fails
  // on "Unexpected token '<' ... is not valid JSON" — a confusing way to
  // discover there is no backend on this port.
  //
  // Run both: `npx wrangler dev --port 8788` alongside `npm run dev`.
  // `wrangler dev` not running simply means these requests fail, which the
  // editor and the reader both already degrade from gracefully.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8788', changeOrigin: true },
      // Published media is served by the worker from R2, not from public/.
      '/media': { target: 'http://localhost:8788', changeOrigin: true },
    },
  },
  // Deliberately a single-input build (index.html only). Adding admin.html
  // as a second rollupOptions.input here would let Rollup dedupe shared
  // modules (React, tokens.css) into a chunk loaded by both pages — which
  // changes this entry's own emitted files. The admin panel is built by a
  // separate Vite invocation (vite.admin.config.js) into the same dist/
  // directory instead, so this config's output stays untouched.
});
