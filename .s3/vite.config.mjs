import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
export default defineConfig({
  envDir: false,
  plugins: [{ name: 'kbe-mocks', enforce: 'pre', resolveId(source) {
    if (source.includes('hooks/useAuth')) return resolve('.s3/auth.js');
    if (source === 'convex/react') return resolve('.s3/convex.js');
  } }, tailwindcss(), react()],
});
