import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    environment: "node",
    // Tests explicitly import from vitest, so globals are not needed
    globals: false,
    passWithNoTests: true,
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      exclude: ["node_modules/", "dist/", "*.d.ts", "*.config.ts"],
    },
  },
});
