import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // "prompt" rather than "autoUpdate": the user gets a banner and decides
      // when to reload, so a deploy can't swap the page out mid-calculation.
      registerType: "prompt",
      // No `includeAssets`: the globPatterns below already sweep up the icons,
      // favicon and manifest, and listing them twice puts duplicate entries in
      // the precache manifest.
      manifest: {
        name: "Solaris Combat Calculator",
        short_name: "Combat Calc",
        description:
          "Standalone combat calculator for Solaris, the space strategy game.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Locks the installed app to portrait. This is the only mechanism that
        // actually holds - see the note in README; a browser tab cannot be
        // stopped from rotating.
        orientation: "portrait",
        theme_color: "#1d2835",
        background_color: "#1d2835",
        categories: ["utilities", "games"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the app needs offline. The Font Awesome .ttf files under
        // assets/ are deliberately left out - they are only a fallback for
        // browsers with no woff2 support, and they are 700kB of the bundle.
        // Chakra Petch under fonts/ ships as .ttf only, so it stays in.
        globPatterns: [
          "**/*.{js,css,html,svg,png,webmanifest,woff2}",
          "fonts/*.ttf",
        ],
        // The plugin already adds the manifest and the icons it references to
        // the precache list; globbing them as well just duplicates the entries.
        globIgnores: [
          "manifest.webmanifest",
          "icons/icon-*.png",
          "icons/maskable-*.png",
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses @import and the legacy colour functions.
        silenceDeprecations: ["import", "global-builtin", "color-functions"],
        quietDeps: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.spec.ts"],
  },
});
