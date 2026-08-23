import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Cloudflare Workers serves from the root; GitHub Pages serves from /bmxcsite/.
  // Set DEPLOY_TARGET=gh-pages to build for the Pages subpath. (The gh-pages
  // workflow is still live until Task 8 removes it — keep this until then.)
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/bmxcsite/' : '/',
  plugins: [react()],
  // Deliberately a single-input build (index.html only). Adding admin.html
  // as a second rollupOptions.input here would let Rollup dedupe shared
  // modules (React, tokens.css) into a chunk loaded by both pages — which
  // changes this entry's own emitted files. The admin panel is built by a
  // separate Vite invocation (vite.admin.config.js) into the same dist/
  // directory instead, so this config's output stays untouched.
});
