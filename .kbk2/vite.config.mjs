import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Exploration harness only. `convex/react` is stubbed so the shipped watch page renders offline.
export default defineConfig({
  envDir: false,
  plugins: [tailwindcss(), react()],
  resolve: { alias: { 'convex/react': fileURLToPath(new URL('./convex-stub.js', import.meta.url)) } },
  optimizeDeps: { entries: ['.kbk2/index.html'] },
  server: { port: 5196, strictPort: true },
});
