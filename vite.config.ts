/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // "/" for Vercel. The GitHub Pages workflow sets VITE_BASE=/<repo-name>/.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      // The authoritative engine lives with the Edge Function; the client imports only its types/constants.
      '@engine': fileURLToPath(new URL('./supabase/functions/_shared/engine', import.meta.url)),
    },
  },
  server: { host: true, port: 5173 },
  test: { environment: 'node', testTimeout: 60_000 },
});
