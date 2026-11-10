import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

/**
 * Renders the optional chart an Ask-AI answer can carry.
 *
 * Both answer payloads (`tenantAiAnswer` / `campaignReportAiAnswer`) may now
 * include an `AiChart` when the question is visualization-worthy. This view
 * takes that shape — `{ type, title, labels, series }` — and draws a compact,
 * dark-theme bar or line chart (per `chart.type`) so it sits cleanly inside the
 * answer block / Ask-AI modal beneath the markdown text. The caller renders
 * this only when `chart` is present, so we always have data here.
 *
 * ── chart.js controller registration ──
 * We render via react-chartjs-2's generic <Chart>, which does NOT auto-register
 * controllers — only the tree-shakeable pieces you register are available. A
 * recent regression crashed the dashboard with "'line' is not a registered
 * controller" because only elements (not controllers) had been registered. So
 * we mirror the now-fixed TenantKpiCharts registration EXACTLY, including
 * BarController AND LineController, so both `type: "bar"` and `type: "line"`
 * work.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
);

export type AiChartSeries = {
  readonly label: string;
  readonly data: readonly number[];
};

export type AiChart = {
  readonly type: string;
  readonly title?: string | null;
  readonly labels: readonly string[];
  readonly series: readonly AiChartSeries[];
};

// Dark-theme palette, reused across series in order. Mirrors the workspace
// chart colors used by TenantKpiCharts (sky / purple / bone / gold).
const PALETTE = [
  "rgba(95,184,239,0.85)", // sky
  "rgb(109,78,195)", // purple
  "rgb(242,243,238)", // bone
  "rgba(244,196,84,0.9)", // gold
  "rgba(239,116,116,0.85)", // coral
];

const TEXT_COLOR = "#e5e7eb";
const GRID_COLOR = "rgba(255,255,255,0.12)";

const AiChartView: React.FC<{ chart: AiChart }> = ({ chart }) => {
  const isLine = chart.type === "line";

  const data: ChartData<"bar" | "line"> = useMemo(
    () => ({
      labels: [...chart.labels],
      datasets: chart.series.map((s, i) => {
        const color = PALETTE[i % PALETTE.length];
        if (isLine) {
          return {
            type: "line" as const,
            label: s.label,
            data: [...s.data],
            borderColor: color,
            backgroundColor: color,
            pointBackgroundColor: color,
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 3,
          };
        }
        return {
          type: "bar" as const,
          label: s.label,
          data: [...s.data],
          backgroundColor: color,
          borderRadius: 6,
        };
      }),
    }),
    [chart.labels, chart.series, isLine],
  );

  const options: ChartOptions<"bar" | "line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          // Single-series charts don't need a legend (the title says it all).
          display: chart.series.length > 1,
          position: "top",
          labels: { color: TEXT_COLOR, font: { size: 11 }, boxWidth: 12 },
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: TEXT_COLOR, font: { size: 10 } },
          grid: { color: GRID_COLOR },
        },
        x: {
          ticks: { color: TEXT_COLOR, font: { size: 10 } },
          grid: { color: GRID_COLOR },
        },
      },
    }),
    [chart.series.length],
  );

  // Nothing meaningful to draw (no labels or no series) → render nothing.
  if (chart.labels.length === 0 || chart.series.length === 0) return null;

  return (
    <div className="mt-4">
      {chart.title ? (
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--spark-text-meta)",
          }}
        >
          {chart.title}
        </p>
      ) : null}
      <div style={{ height: 220 }}>
        <Chart type={isLine ? "line" : "bar"} data={data} options={options} />
      </div>
    </div>
  );
};

export default AiChartView;
