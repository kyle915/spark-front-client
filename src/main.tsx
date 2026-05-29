import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "leaflet/dist/leaflet.css";
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
