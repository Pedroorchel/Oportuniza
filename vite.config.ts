import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function resolveBasePath(): string {
  const raw = (process.env.VITE_BASE_PATH || '').trim();
  if (!raw || raw === './') return './';
  const normalized = raw.replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

export default defineConfig(() => {
  return {
    base: resolveBasePath(),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
