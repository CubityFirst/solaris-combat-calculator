import { bindings, defineConfig } from "cf/config";

// Worker config for the `cf` CLI. Build settings (the ./dist asset directory)
// live in wrangler.config.ts.

export default defineConfig({
  accountId: "d843ae90cab33e54f4d284bc65d2fd6a",
  worker: {
    name: "solaris-combat-calculator",
    compatibilityDate: "2025-07-01",
    entrypoint: "worker/index.ts",
    // Served only on the custom domain below; workers.dev stays off, as it was
    // under Wrangler (which disables it by default once routes are set).
    workersDev: false,
    assets: {
      // Single page app: unknown paths fall back to index.html.
      notFoundHandling: "single-page-application",
      // Let the Worker see every request so it can attach security headers.
      runWorkerFirst: true,
    },
    domains: ["combat.solaris.cubityfir.st"],
    observability: {
      enabled: true,
    },
    env: {
      ASSETS: bindings.assets(),
    },
  },
});
