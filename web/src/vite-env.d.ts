/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional: send the dashboard's own feedback to this project (see src/lib/feedbackkit.ts). */
  readonly VITE_FEEDBACKKIT_PROJECT_KEY?: string;
  readonly VITE_FEEDBACKKIT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** web/package.json's version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;
/** Short git commit the bundle was built from ("" if unknown), injected by vite.config.ts. */
declare const __APP_COMMIT__: string;
