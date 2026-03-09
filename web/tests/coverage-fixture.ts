import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const NYC_OUTPUT_DIR = path.join(process.cwd(), ".nyc_output");

/**
 * Extended Playwright test that collects Istanbul coverage data from
 * window.__coverage__ after each test. When the build is instrumented
 * (VITE_COVERAGE=true), coverage JSON is written to .nyc_output/ for
 * later merging with vitest coverage via nyc.
 *
 * When the build is NOT instrumented, this is a no-op.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);

    // Collect coverage after the test completes
    try {
      const coverage = await page.evaluate(() => (window as any).__coverage__);
      if (coverage) {
        if (!fs.existsSync(NYC_OUTPUT_DIR)) {
          fs.mkdirSync(NYC_OUTPUT_DIR, { recursive: true });
        }
        const filename = `playwright-${testInfo.testId}-${Date.now()}.json`;
        fs.writeFileSync(
          path.join(NYC_OUTPUT_DIR, filename),
          JSON.stringify(coverage),
        );
      }
    } catch {
      // Page may be closed or build may not be instrumented — silently skip
    }
  },
});

export { expect };
