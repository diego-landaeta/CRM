/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** La versión del CRM, puesta por Vite al compilar (`define` en vite.config.js). */
declare const __APP_VERSION__: string;
