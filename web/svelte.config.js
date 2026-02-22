import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "404.html",
      precompress: false,
      strict: true,
    }),
    prerender: {
      handleHttpError: ({ path, message }) => {
        // /stats is implemented in Phase 6 — not an error during Phase 4 build
        if (path === '/stats') return;
        throw new Error(message);
      },
    },
  },
};

export default config;
