import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the admin panel as a second, independent entry point, emitting
// into the same dist/ directory as the public site's build (vite.config.js).
// Kept as a separate Vite invocation — not a second rollupOptions.input on
// the main config — so the two entries never share a Rollup module graph.
// Sharing a graph lets Rollup extract common modules (React, tokens.css)
// into a chunk loaded by both pages, which changes the public entry's own
// emitted file contents and breaks byte-identical public-site builds.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    // Never wipe dist/: the public build (vite.config.js) runs first and
    // this build must add to it, not replace it.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
