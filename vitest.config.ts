import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // browser tests (tests/e2e) run with Playwright, not Vitest
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    testTimeout: 30000,
  },
});
