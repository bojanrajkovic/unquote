import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), svelte({ hot: false })],
  resolve: {
    alias: {
      // Mirror the $lib alias that SvelteKit sets up in vite.config.ts
      $lib: path.resolve("./src/lib"),
      // Mock $app/environment for testing
      "$app/environment": path.resolve("./vitest.setup.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".svelte-kit", "build"],
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
