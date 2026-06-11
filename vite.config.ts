import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

  const manualChunks = (id: string): string | undefined => {
    if (!id.includes('node_modules')) return undefined;
    if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts';
    if (id.includes('/motion/')) return 'vendor-motion';
    if (id.includes('/react-hook-form/') || id.includes('/@hookform/')) return 'vendor-forms';
    if (id.includes('/axios/')) return 'vendor-http';
    // antd + its rc-* internals are the single largest dependency; isolating
    // them (and the react runtime) into stable vendor chunks means app-code
    // deploys don't invalidate the user's cached copy of these heavy bundles.
    if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-')) return 'vendor-antd';
    if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
    if (id.includes('/lucide-react/')) return 'vendor-icons';
    return undefined;
  };

  // Build allowed hosts using the env object (loaded from .env by loadEnv above)
  const extraHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((h: string) => h.trim())
    : [];

  const appBaseHost = env.APP_BASE_URL
    ? new URL(env.APP_BASE_URL).hostname
    : '';

  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    'peter-adel.taila6a2b4.ts.net',
    ...extraHosts,
    ...(appBaseHost ? [appBaseHost] : []),
  ];

  return {
    plugins: [react(), tailwindcss()],
    base: isCapacitor ? './' : '/',
    define: {
      // NOTE: never `define` server-side secrets (e.g. GEMINI_API_KEY) here —
      // anything defined is inlined into the public client bundle.
      'import.meta.env.VITE_FIREBASE_VAPID_KEY': JSON.stringify(env.VITE_FIREBASE_VAPID_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: env.VITE_API_BASE || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
      // Strip all console.log/warn/info in production builds
      minify: 'esbuild',
    },
    esbuild: {
      drop: isCapacitor || mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
