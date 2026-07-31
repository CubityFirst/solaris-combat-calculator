/**
 * Cloudflare Worker in front of the built static site.
 *
 * `run_worker_first` is on in wrangler.jsonc so every request lands here first;
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
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
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

    const assetResponse = await env.ASSETS.fetch(request);

    const response = new Response(assetResponse.body, assetResponse);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }

    // Vite fingerprints everything under /assets, so those can be cached hard.
    // The HTML entry point must not be, or deploys won't be picked up.
    if (isHashedAsset(url.pathname)) {
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (
      response.headers.get("Content-Type")?.includes("text/html")
    ) {
      response.headers.set("Cache-Control", "no-cache");
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
