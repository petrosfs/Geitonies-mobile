import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build for a quick preview link (one-phone mode only, no online play, no install)
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 },
});
