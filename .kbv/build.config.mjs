import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  envDir: false,
  mode: 'development',
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  plugins: [tailwindcss(), react()],
  build: { outDir: '.kbv/dist', emptyOutDir: true, minify: 'esbuild', lib: { entry: '.kbv/harness.jsx', name: 'KBV', formats: ['iife'], fileName: 'kbv' }, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
