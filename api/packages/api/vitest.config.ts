import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules", "dist"],
    globals: true,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    passWithNoTests: true,
    testTimeout: 10_000,
    coverage: {
      exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/*.config.ts"],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
