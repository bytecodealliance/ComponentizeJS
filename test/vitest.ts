import { defineConfig } from 'vitest/config';

const DEFAULT_TIMEOUT_MS = 120_000;

const REPORTERS = process.env.GITHUB_ACTIONS
  ? ['verbose', 'github-actions']
  : ['verbose'];

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
    testTimeout: DEFAULT_TIMEOUT_MS,
    hookTimeout: DEFAULT_TIMEOUT_MS,
    teardownTimeout: DEFAULT_TIMEOUT_MS,
  },
});
