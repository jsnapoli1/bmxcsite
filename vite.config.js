import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Cloudflare Workers serves from the root; GitHub Pages serves from /bmxcsite/.
  // Set DEPLOY_TARGET=gh-pages to build for the Pages subpath.
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/bmxcsite/' : '/',
  plugins: [react()],
});
