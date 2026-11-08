import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), base: '/period-viewer/',
  plugins: [tailwindcss(), react()],
  resolve: { alias: { 'convex/react': fileURLToPath(new URL('./convexFixture.jsx', import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL('../../../../dist/period-viewer', import.meta.url)), emptyOutDir: true },
});
