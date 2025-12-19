import { Chart, registerables } from "chart.js";

// Ensure all default controllers/elements/plugins are available in production bundles.
Chart.register(...registerables);
