import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const keycloakUrl = env.VITE_KEYCLOAK_URL;

  return {
    plugins: [react()],
    server: {
      port: 4200,
      allowedHosts: ['.ngrok-free.app'],
      proxy: keycloakUrl
        ? {
            '/__keycloak': {
              target: keycloakUrl,
              changeOrigin: true,
              secure: false,
              headers: {
                'ngrok-skip-browser-warning': 'true',
              },
              rewrite: (path) => path.replace(/^\/__keycloak/, ''),
            },
          }
        : undefined,
    },
  };
});
