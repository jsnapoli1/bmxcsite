import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // ensures assets load correctly on GitHub Pages
  base: '/bmxcsite/',
  plugins: [react()],
});
