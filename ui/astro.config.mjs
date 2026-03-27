import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [svelte()],
  outDir: './dist',
  output: 'static',
  base: '/',
  vite: {
    plugins: [tailwindcss()],
  },
});
