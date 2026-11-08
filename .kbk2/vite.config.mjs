import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Separate acceptance build; the normal app build never includes fixture screens.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: '.kbk2/dist', emptyOutDir: false, rollupOptions: { input: resolve('.kbk2/index.html') } },
});
