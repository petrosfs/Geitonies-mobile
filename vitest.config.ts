import { readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';


// version shown in the app (home screen and ✕ menu)
const APP_DEFINES = {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version),
  __APP_BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
};

export default defineConfig({
  define: APP_DEFINES,
  test: {
    // browser tests (tests/e2e) run with Playwright, not Vitest
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    testTimeout: 30000,
  },
});
