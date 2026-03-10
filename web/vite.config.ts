import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // tailwindcss MUST come before sveltekit — processes CSS before HMR transform
    tailwindcss(),
    sveltekit(),
  ],
  build: {
    sourcemap: true,
    // Bundle is ~46 KB gzipped total — single chunk is faster than waterfall
    rollupOptions: {
      output: {
        manualChunks: () => "app",
      },
    },
  },
});
