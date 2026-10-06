import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build for a quick preview link (one-phone mode only, no online play, no install)

// version shown in the app (home screen and ✕ menu)
const APP_DEFINES = {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version),
  __APP_BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
};

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1'), ...APP_DEFINES },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 },
});
