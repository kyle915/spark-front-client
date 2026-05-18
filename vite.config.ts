import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import packageJson from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({ babel: { plugins: ["relay"] } }), tailwindcss()],
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
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react-relay") || id.includes("/relay-runtime")) {
            return "vendor-relay";
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/@vis.gl/") || id.includes("/leaflet/") || id.includes("/react-leaflet/")) {
            return "vendor-maps";
          }
          if (id.includes("/@heroicons/") || id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("/xlsx/") || id.includes("/papaparse/")) {
            return "vendor-parsers";
          }
          if (id.includes("/zustand/") || id.includes("/react-hook-form/") || id.includes("/zod/")) {
            return "vendor-forms";
          }
          if (
            id.includes("/heic2any") ||
            id.includes("/jszip") ||
            id.includes("/wasm-bundle") ||
            id.includes("/libheif")
          ) {
            // These are already loaded via dynamic import (see
            // HeicImage / SparkRecapView) — keep them out of vendor-react.
            return undefined;
          }
          return "vendor-misc";
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
