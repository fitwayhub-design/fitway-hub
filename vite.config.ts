import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

  const manualChunks = (id: string): string | undefined => {
    if (!id.includes('node_modules')) return undefined;
    // clsx is used by the eager cn() helper AND by lazy chart pages. Pin it to
    // the always-loaded react chunk so Rollup can't merge it into a heavy lazy
    // chunk and turn that chunk into a static dependency of the entry.
    if (id.includes('node_modules/clsx/')) return 'vendor-react';
    if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts';
    // Match ONLY the motion/framer-motion packages. A bare '/motion/' substring
    // also matched antd's es/**/motion/* styles and rc-motion, which silently
    // dragged the entire antd bundle into the boot path.
    if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) return 'vendor-motion';
    if (id.includes('/react-hook-form/') || id.includes('/@hookform/')) return 'vendor-forms';
    if (id.includes('/axios/')) return 'vendor-http';
    // NOTE: deliberately NO manual chunk rule for antd/rc-*. Forcing antd's
    // ~1000 modules into one named chunk made Rollup emit a static
    // `import "./vendor-antd.js"` from the entry (module-ordering effect),
    // putting ~353 kB gzip of antd into the boot path even though only the
    // lazy ads pages use it. With auto-chunking, antd splits into a chunk
    // loaded strictly on demand by those pages — verified via entry static
    // imports. Don't re-add an antd rule without re-checking that.
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
