import { defineConfig } from 'vitest/config';

/**
 * Under high concurrency, tests (in partticular bindings generation) can take
 * much longer than expected.
 *
 * This issues primarily happen in CI and not locally on a sufficiently powerful machine.
 */
const TIMEOUT_MS = process.env.CI ? 240_000 : 120_000;

const REPORTERS = process.env.GITHUB_ACTIONS
  ? ['verbose', 'github-actions']
  : ['verbose'];

/**
 *
 * Retry is set because there are issues that can randomly happen under high test concurrency:
 *   - file systems issues
 *   - performance under concurrency issues (see `builtins.performance.js` test)
 *
 * These issues primarily happen in CI and not locally, on a sufficiently powerful machine.
 */
const RETRY = process.env.CI ? 3 : 0;

export default defineConfig({
  test: {
    reporters: REPORTERS,
    disableConsoleIntercept: true,
    printConsoleTrace: true,
    passWithNoTests: false,
    include: ['test/**/*.js'],
    setupFiles: ['test/meta-resolve-stub.ts'],
    exclude: [
      'test/api/*',
      'test/builtins/*',
      'test/cases/*',
      'test/output/*',
      'test/util.js',
    ],
    testTimeout: TIMEOUT_MS,
    hookTimeout: TIMEOUT_MS,
    teardownTimeout: TIMEOUT_MS,
  },
});
