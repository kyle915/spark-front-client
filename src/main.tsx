import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// leaflet.css intentionally NOT imported here: a global import of
// "leaflet/dist/leaflet.css" statically chained the entire 340KB
// vendor-maps JS chunk into every first paint (the CSS module is
// assigned to that chunk by the manualChunks rule). Each map component
// in src/shared imports it instead, so it rides with the lazy map
// routes. Vite dedupes the repeated imports into one stylesheet.
// Chart.js registration moved out of the eager entry bundle: each chart
// component in src/components/charts/* now imports "@/lib/chartSetup"
// itself, so Chart.js loads only with the (lazy) dashboard/report routes
// that render charts instead of on every cold page load.
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
