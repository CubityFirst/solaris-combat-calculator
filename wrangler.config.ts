import { defineWranglerConfig } from "wrangler/experimental-config";

// Wrangler build settings for the Worker in worker/index.ts (Worker config and
// bindings live in cloudflare.config.ts).
//
// The repo also uses Vite for the app, so `cf build` / `cf dev` detect it as a
// Vite framework project and run `vite` instead of Wrangler. That is fine for
// `cf dev` (plain Vite, no Worker), but a deploy needs the Worker built by
// `cf-wrangler build` and then shipped with `cf deploy --prebuilt`. See the
// `build:worker` and `deploy` scripts in package.json.
export default defineWranglerConfig({
  // Built by `npm run build` (vue-tsc --noEmit && vite build).
  assetsDirectory: "./dist",
  // Match the previous `wrangler deploy` default (no source map upload).
  uploadSourceMaps: false,
});
