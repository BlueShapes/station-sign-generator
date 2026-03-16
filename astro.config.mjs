// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'static',
  site: 'https://stationsigngen.aosankaku.net',
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: ['@mantine/core', '@mantine/hooks'],
    },
    resolve: {
      // Vite picks sql-wasm-browser.js (no default export) via the browser condition.
      // Alias to the CJS build so Vite's pre-bundler wraps it with a synthetic default.
      alias: {
        'sql.js': resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'),
      },
    },
    optimizeDeps: {
      include: ['sql.js'],
    },
  },
});
