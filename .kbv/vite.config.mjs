import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ envDir: false, plugins: [tailwindcss(), react()], server: { port: 5191, strictPort: true } });
