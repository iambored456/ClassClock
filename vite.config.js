// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // 👇 important for GitHub Pages; replace with *your* repo slug
  base: '/ClassClock/',

  build: {
    outDir: 'docs',   // where Vite writes the bundle
    emptyOutDir: true // wipe old files before each build
  }
});
