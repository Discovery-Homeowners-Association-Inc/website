import { defineConfig } from "vitest/config";

/**
 * Unit tests live beside the code they test. `tests/` is Playwright's, and
 * its specs throw if vitest collects them, so the two runners are kept apart
 * by where a test file sits rather than by what it is called.
 */
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
