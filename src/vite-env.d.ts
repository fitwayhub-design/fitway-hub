/// <reference types="vite/client" />

// Fallback shim for when vite types aren't installed (e.g. type-check only env)
interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept(): void;
    dispose(cb: (data: unknown) => void): void;
    data: unknown;
  };
}

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
  readonly [key: string]: string | boolean | undefined;
}
