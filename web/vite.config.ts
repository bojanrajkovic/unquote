import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import istanbul from "vite-plugin-istanbul";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // tailwindcss MUST come before sveltekit — processes CSS before HMR transform
    tailwindcss(),
    sveltekit(),
    ...(process.env.VITE_COVERAGE
      ? [
          istanbul({
            include: "src/**/*.{ts,svelte}",
            exclude: [
              "node_modules/**",
              ".svelte-kit/**",
              "build/**",
              "**/*.test.ts",
            ],
            extension: [".ts", ".svelte"],
            requireEnv: true,
            forceBuildInstrument: true,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: !!process.env.VITE_COVERAGE,
    // Bundle is ~46 KB gzipped total — single chunk is faster than waterfall
    rollupOptions: {
      output: {
        manualChunks: () => "app",
      },
    },
  },
});
