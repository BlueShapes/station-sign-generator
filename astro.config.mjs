// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  site: 'https://blueshapes.github.io',
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: ['@mantine/core', '@mantine/hooks'],
    },
  },
});
