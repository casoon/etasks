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
    resolve: {
      conditions: ['browser', 'module', 'default'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/components/views/')) return 'views';
            if (id.includes('/components/modals/')) return 'modals';
          },
        },
      },
    },
  },
});
