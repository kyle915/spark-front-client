import { Chart, registerables } from "chart.js";

// Ensure all default controllers/elements/plugins are available in production bundles.
Chart.register(...registerables);

const DARK_THEME = "bijinesu";

const updateChartTheme = () => {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === DARK_THEME;
  const styles = getComputedStyle(root);
  const cssText = styles.getPropertyValue("--color-base-content").trim();
  let textColor = styles.color || (isDark ? "#e2e8f0" : "#334155");
  if (typeof document !== "undefined" && document.body) {
    const sample = document.createElement("span");
    sample.className = "text-base-content";
    sample.style.position = "absolute";
    sample.style.visibility = "hidden";
    sample.style.pointerEvents = "none";
    document.body.appendChild(sample);
    const sampledColor = getComputedStyle(sample).color;
    sample.remove();
    if (sampledColor) textColor = sampledColor;
  } else if (cssText) {
    textColor = cssText;
  }
  const gridColor = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.12)";

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;
  Chart.defaults.plugins.legend.labels.color = textColor;
  Chart.defaults.plugins.tooltip.titleColor = textColor;
  Chart.defaults.plugins.tooltip.bodyColor = textColor;

  const scales = Chart.defaults.scales;
  if (scales?.linear) {
    scales.linear.grid && (scales.linear.grid.color = gridColor);
    scales.linear.ticks && (scales.linear.ticks.color = textColor);
    scales.linear.title && (scales.linear.title.color = textColor);
  }
  if (scales?.category) {
    scales.category.grid && (scales.category.grid.color = gridColor);
    scales.category.ticks && (scales.category.ticks.color = textColor);
    scales.category.title && (scales.category.title.color = textColor);
  }
  if (scales?.time) {
    scales.time.grid && (scales.time.grid.color = gridColor);
    scales.time.ticks && (scales.time.ticks.color = textColor);
    scales.time.title && (scales.time.title.color = textColor);
  }
  if (scales?.radialLinear) {
    scales.radialLinear.grid && (scales.radialLinear.grid.color = gridColor);
    scales.radialLinear.ticks && (scales.radialLinear.ticks.color = textColor);
  }

  const instances = (Chart as unknown as { instances?: unknown }).instances;
  if (instances instanceof Map) {
    instances.forEach((chart) => chart.update());
  } else if (instances && typeof instances === "object") {
    Object.values(instances as Record<string, { update: () => void }>).forEach(
      (chart) => chart.update()
    );
  }
};

if (typeof window !== "undefined") {
  updateChartTheme();

  const observer = new MutationObserver(() => updateChartTheme());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
