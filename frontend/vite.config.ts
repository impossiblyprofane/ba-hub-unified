import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [qwikCity(), qwikVite()],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },
  build: {
    // SSR build outputs to dist/server/ (not server/ which has source files)
    outDir: resolve(__dirname, 'dist'),
  },
  server: {
    port: 3000,
    strictPort: true,
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});
