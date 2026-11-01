import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Exploration k2 harness: only the board, the shell and the engine; no auth, Convex or router.
export default defineConfig({ envDir: false, server: { port: 5347, strictPort: true }, plugins: [tailwindcss(), react()] });
