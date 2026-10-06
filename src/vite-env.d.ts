/// <reference types="vite/client" />

/** app version from package.json (set at build time) */
declare const __APP_VERSION__: string;
/** short git commit of the build ('dev' when built locally) */
declare const __APP_BUILD__: string;
