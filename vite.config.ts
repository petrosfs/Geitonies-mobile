import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' so the app works from any folder (e.g. GitHub Pages /repo-name/)

// version shown in the app (home screen and ✕ menu)
const APP_DEFINES = {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version),
  __APP_BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
};

export default defineConfig({
  define: APP_DEFINES,
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Γειτονιές',
        short_name: 'Γειτονιές',
        description: 'Επιτραπέζιο ακινήτων για 2–10 παίκτες',
        lang: 'el',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f3b5f',
        theme_color: '#0f3b5f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
