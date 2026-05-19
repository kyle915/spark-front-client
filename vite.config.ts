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
        // SAFER chunking — only split out leaf libraries that don't
        // import React (avoiding the TDZ / module-identity crashes we
        // hit when we tried to split react / react-relay / react-router
        // into separate chunks). Maps + parsers + icons are
        // self-contained or already lazy-loaded, so it's safe.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@vis.gl/") || id.includes("/leaflet/") || id.includes("/react-leaflet/")) {
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
