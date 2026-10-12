/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  version: string;
};

function shortCommitHash(): string | undefined {
  const fromActions = process.env.GITHUB_SHA?.trim();
  if (fromActions) {
    return fromActions.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

const commit = shortCommitHash();
const appVersion = commit ? `${version} · Commit ${commit}` : version;

/** Base path from VITE_BASE_PATH, e.g. "/mock-fe/" for sub-path deploys. */
function resolveBasePath(basePath: string | undefined): string {
  const base = basePath?.trim();
  if (!base) {
    return '/';
  }
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  // Process env (shell/CI/Docker) wins over .env.
  const basePath = process.env.VITE_BASE_PATH ?? loadEnv(mode, process.cwd(), '').VITE_BASE_PATH;

  return {
    base: resolveBasePath(basePath),
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react()],
    server: {
      port: 4200,
      allowedHosts: ['.ngrok-free.app'],
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
      css: false,
    },
  };
});
