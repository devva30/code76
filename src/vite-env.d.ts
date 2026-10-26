/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Java catalogue API, e.g. http://localhost:8080. Unset → bundled demo catalogue. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
