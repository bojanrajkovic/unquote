import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // tailwindcss MUST come before sveltekit — processes CSS before HMR transform
    tailwindcss(),
    sveltekit(),
  ],
});
