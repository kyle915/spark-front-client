import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({ babel: { plugins: ["relay"] } }), tailwindcss()],
  optimizeDeps: {
    exclude: ["leaflet", "react-leaflet"],
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
