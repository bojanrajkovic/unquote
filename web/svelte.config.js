import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: true,
    }),
    // Never add trailing slashes — /game not /game/
    // Ensures CloudFront routes work correctly without redirect loops.
    trailingSlash: 'never',
  },
};

export default config;
