import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
export default defineConfig({
  envDir: false,
  mode: 'development',
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  plugins: [{ name: 's3-mocks', enforce: 'pre', resolveId(source) {
    if (source.includes('hooks/useAuth')) return resolve('.s3/auth.js');
    if (source === 'convex/react') return resolve('.s3/convex.js');
    // the exploration board stands in for the court board, in this harness only
    if (source === './scoring/KabaddiRaidBoard') return resolve('src/designs/design1-mono/scoring/KabaddiSplitBoard.jsx');
  } }, tailwindcss(), react()],
  build: { outDir: '.s3/dist', emptyOutDir: true, minify: 'esbuild', lib: { entry: '.s3/harness.jsx', name: 'KBE', formats: ['iife'], fileName: 'kbe' }, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
