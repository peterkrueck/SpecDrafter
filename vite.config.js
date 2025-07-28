import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,  // Frontend on 3001, backend on 3002
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true
      }
    }
  }
});