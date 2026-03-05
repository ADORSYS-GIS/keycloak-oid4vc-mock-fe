import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    proxy: {
      '/realms': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false, // In case of local self-signed certs
      },
    },
  },
});
