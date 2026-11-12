/**
 * Cloudflare Worker in front of the built static site.
 *
 * `runWorkerFirst` is on in cloudflare.config.ts so every request lands here first;
 * the Worker delegates to the static-asset binding and decorates the response
 * with security + caching headers.
 */
export interface Env {
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  // The calculator is entirely client-side: no network calls, no third-party
  // origins. 'unsafe-inline' is needed for the styles Vue injects at runtime.
  // `worker-src` is stated explicitly rather than left to fall back to
  // `default-src`, so a later edit to this policy can't silently stop the
  // service worker registering.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

const isHashedAsset = (pathname: string) => /\/assets\/.+\.[0-9a-f]{8,}\./.test(pathname);

// Files that must never be served stale, or clients get pinned to an old
// deploy: the service worker script and its precache manifest, and the web
// app manifest.
const NEVER_CACHE = new Set([
  "/sw.js",
  "/registerSW.js",
  "/manifest.webmanifest",
]);

// Workbox's runtime chunk sits at the root but is content-hashed, so it caches
// like anything under /assets.
const isHashedRootChunk = (pathname: string) =>
  /^\/workbox-[0-9a-z]+\.js$/i.test(pathname);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    // The asset server's default html_handling 307-redirects /index.html to /.
    // Workbox precaches the entry point as "index.html" and rejects a redirect
    // as a bad precache response, which aborts the entire service worker
    // install - so serve the root document directly for that path instead.
    const assetRequest =
      url.pathname === "/index.html"
        ? new Request(new URL("/", url), request)
        : request;

    const assetResponse = await env.ASSETS.fetch(assetRequest);

    const response = new Response(assetResponse.body, assetResponse);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }

    // Vite fingerprints everything under /assets, so those can be cached hard.
    // The HTML entry point, the service worker and the manifest must not be, or
    // clients stay pinned to an old deploy.
    if (NEVER_CACHE.has(url.pathname)) {
      response.headers.set("Cache-Control", "no-cache");
    } else if (isHashedAsset(url.pathname) || isHashedRootChunk(url.pathname)) {
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (response.headers.get("Content-Type")?.includes("text/html")) {
      response.headers.set("Cache-Control", "no-cache");
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
