import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // lib/national.ts reads data shards with node built-ins on the server;
      // the browser bundle gets inert stubs (offline fallback = curated only).
      'node:fs': path.resolve(__dirname, './src/shims/node-stub.ts'),
      'node:zlib': path.resolve(__dirname, './src/shims/node-stub.ts'),
      'node:url': path.resolve(__dirname, './src/shims/node-stub.ts'),
      'node:path': path.resolve(__dirname, './src/shims/node-stub.ts'),
    },
  },
  server: { port: 5173 },
});
