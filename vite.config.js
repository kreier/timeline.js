import { defineConfig } from 'vite';

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/
// so the base path MUST match the repo name exactly (this is the exact bug
// you already diagnosed on jwlibrary-merge-web - same fix applies here).
export default defineConfig({
  base: '/timeline.js/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
