import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  // Deliberately a single-input build (index.html only). Adding admin.html
  // as a second rollupOptions.input here would let Rollup dedupe shared
  // modules (React, tokens.css) into a chunk loaded by both pages — which
  // changes this entry's own emitted files. The admin panel is built by a
  // separate Vite invocation (vite.admin.config.js) into the same dist/
  // directory instead, so this config's output stays untouched.
});
