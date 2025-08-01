import { defineConfig } from 'vitest/config';

/**
 * Under high concurrency, tests (in partticular bindings generation) can take
 * much longer than expected.
 *
 * This issues primarily happen in CI and not locally on a sufficiently powerful machine.
 */
const TIMEOUT_MS = process.env.CI ? 240_000 : 120_000;

/**
 * On relatively modest machines in CI when weval is enabled,
 * tests that use it (i.e. any test that does a build w/ enableAot) can
 * suffer from CPU resource contention.
 */
const MAX_CONCURRENT_SUITES =
  process.env.CI && process.env.WEVAL_TEST ? 1 : undefined;

const REPORTERS = process.env.GITHUB_ACTIONS
  ? ['verbose', 'github-actions']
  : ['verbose'];

/**
 *
 * Retry is set because there are issues that can randomly happen under high test concurrency:
 *   - file systems issues (weval[.exe] is busy)
 *   - performance under concurrency issues (see `builtins.performance.js` test)
 *
 * These issues primarily happen in CI and not locally, on a sufficiently powerful machine.
 */
const RETRY = process.env.CI ? 3 : 0;

export default defineConfig({
  test: {
    reporters: REPORTERS,
    disableConsoleIntercept: true,
    retry: RETRY,
    printConsoleTrace: true,
    passWithNoTests: false,
    /**
     * We use only one concurrent suite because tools like Weval
     * are very sensitive to other operations, and during tests
     * we will blow through timeouts and performance
     *
     * Inside individual suites, test.concurrent will still enable tests
     * to be run side-by-side (see TIMEOUT_MS and RETRY which enable
     * those tests to eventually pass despite increased load).
     */
    maxConcurrentSuites: MAX_CONCURRENT_SUITES,
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
