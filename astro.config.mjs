import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jacobchau.vercel.app',

  // The site collapsed from four routes to one. These keep any link that was
  // already shared — or indexed — from landing on a 404.
  redirects: {
    '/projects': '/#work',
    '/experience': '/#path',
    '/contact': '/#contact',
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
