import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import packageJson from "./package.json";

const DEFAULT_API_ORIGIN = "https://spark-api-new-490085168610.us-central1.run.app";

/**
 * Emit `<link rel="preconnect">` (and `dns-prefetch` fallback) for the active
 * GraphQL API origin so DNS + TCP + TLS start during HTML parsing rather than
 * waiting for the JS bundle to execute. Reads `VITE_GRAPHQL_ENDPOINT` via
 * `configResolved` so prod, staging, and custom API domains always preconnect
 * accurately while keeping `vite.config.ts` a plain object for `mergeConfig`.
 */
function apiOriginPreconnect(): Plugin {
  let origin = DEFAULT_API_ORIGIN;
  return {
    name: "spark-api-preconnect",
    configResolved(config) {
      const endpoint =
        process.env.VITE_GRAPHQL_ENDPOINT ||
        (config.env?.VITE_GRAPHQL_ENDPOINT as string | undefined);
      if (!endpoint) return;
      try {
        const parsed = new URL(endpoint);
        if (
          (parsed.protocol === "https:" || parsed.protocol === "http:") &&
          parsed.hostname !== "localhost" &&
          parsed.hostname !== "127.0.0.1"
        ) {
          origin = parsed.origin;
        }
      } catch {
        // keep DEFAULT_API_ORIGIN
      }
    },
    transformIndexHtml() {
      return [
        {
          tag: "link",
          attrs: { rel: "preconnect", href: origin, crossorigin: "" },
          injectTo: "head-prepend",
        },
        {
          tag: "link",
          attrs: { rel: "dns-prefetch", href: origin },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// macOS resolves TenantLogo.tsx and tenantLogo.ts as the same stem and
// Vite then prefers .ts, so the component import never reaches the tsx.
// Linux builds keep them apart. Pin both ids before the default resolver.
function caseSensitiveTenantLogo() {
  const layout = path.resolve("src/layout");
  return {
    name: "case-sensitive-tenant-logo",
    enforce: "pre" as const,
    resolveId(source: string) {
      const bare = source.split("?")[0];
      if (
        bare === "./tenantLogo" ||
        bare === "@/layout/tenantLogo" ||
        bare.endsWith("/tenantLogo")
      ) {
        return path.join(layout, "tenantLogo.ts");
      }
      if (
        bare === "./TenantLogo" ||
        bare === "@/layout/TenantLogo" ||
        bare.endsWith("/TenantLogo")
      ) {
        return path.join(layout, "TenantLogo.tsx");
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    apiOriginPreconnect(),
    caseSensitiveTenantLogo(),
    react({ babel: { plugins: ["relay"] } }),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  optimizeDeps: {
    exclude: ["leaflet", "react-leaflet"],
  },
  build: {
    // Lift the warn threshold but more importantly split the giant
    // shared bundle into purpose-built chunks so cold-load only pulls
    // what the route needs. Pre-fix: 2.7MB single index chunk. Post-
    // fix: ~700KB react/router/relay + per-route chunks.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // SAFER chunking — only split out leaf libraries that don't
        // import React (avoiding the TDZ / module-identity crashes we
        // hit when we tried to split react / react-relay / react-router
        // into separate chunks). Maps + parsers + icons are
        // self-contained or already lazy-loaded, so it's safe.
        manualChunks: (id) => {
          // Vite's virtual CJS-interop helper (getDefaultExportFromCjs) has a
          // \0-prefixed id with NO node_modules segment, so it must be matched
          // BEFORE the early-return below. Rollup parks it wherever convenient
          // — when that's a heavy lazy chunk (xlsx/papaparse are CJS), the
          // ENTRY grows a static edge to that whole chunk just to reach the
          // 3-line helper. Pin it into the always-preloaded core chunk.
          if (id.includes("commonjsHelpers")) return "vendor-react";
          if (!id.includes("node_modules")) return undefined;
          // react + react-dom + scheduler pinned together in ONE chunk that
          // everything else imports INTO (it imports nothing app-side, so no
          // cross-chunk init cycle — unlike the react/relay/router three-way
          // split that TDZ-crashed). Without this pin, Rollup stashed the
          // base react-dom module inside vendor-maps (its only static
          // importers were the map libs), which made the ENTRY statically
          // import the whole 340KB maps chunk just to reach createPortal —
          // putting leaflet in every first paint including the login page.
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/") ||
            // fast-deep-equal is shared by @vis.gl AND eager form libs;
            // left unpinned, Rollup stashes it in vendor-maps and the entry
            // re-grows a static edge to the whole maps chunk (same trap as
            // react-dom above). It's a React-free 1KB util — riding in the
            // always-preloaded core chunk is the cheap, safe home.
            id.includes("/node_modules/fast-deep-equal/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/@vis.gl/") || id.includes("/leaflet/") || id.includes("/react-leaflet/")) {
            return "vendor-maps";
          }
          // Geo-heatmap leaf libs: d3-geo (+ its d3-array transitive) /
          // topojson-client / us-atlas are self-contained and don't import
          // React, so they're safe to split (same TDZ-safety rule as above —
          // only React-free leaf libraries get their own chunk). The choropleth
          // renders straight from these now (no react-simple-maps), so this
          // keeps the map weight out of the main index chunk.
          if (
            id.includes("/d3-geo/") ||
            id.includes("/d3-array/") ||
            id.includes("/topojson-client/") ||
            id.includes("/us-atlas/")
          ) {
            return "vendor-maps";
          }
          if (id.includes("/xlsx/") || id.includes("/papaparse/")) {
            return "vendor-parsers";
          }
          if (id.includes("/@heroicons/") || id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          // heic2any + jszip are loaded via dynamic import in
          // HeicImage / SparkRecapView — let Rollup handle them.
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@auth": path.resolve(__dirname, "./src/auth"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@store": path.resolve(__dirname, "./src/store"),
      "@routes": path.resolve(__dirname, "./src/routes"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@requests": path.resolve(__dirname, "./src/requests"),
      "leaflet/dist/leaflet.css": path.resolve(
        __dirname,
        "./node_modules/leaflet/dist/leaflet.css"
      ),
      "leaflet/dist/images/marker-icon.png?url": path.resolve(
        __dirname,
        "./node_modules/leaflet/dist/images/marker-icon.png"
      ),
      "leaflet/dist/images/marker-icon-2x.png?url": path.resolve(
        __dirname,
        "./node_modules/leaflet/dist/images/marker-icon-2x.png"
      ),
      "leaflet/dist/images/marker-shadow.png?url": path.resolve(
        __dirname,
        "./node_modules/leaflet/dist/images/marker-shadow.png"
      ),
      leaflet: path.resolve(
        __dirname,
        "./node_modules/leaflet/dist/leaflet-src.esm.js"
      ),
    },
  },
});
