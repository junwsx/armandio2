import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → funziona su GitHub Pages qualunque sia il nome del repository
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  optimizeDeps: { exclude: ['@imgly/background-removal'] },
});
