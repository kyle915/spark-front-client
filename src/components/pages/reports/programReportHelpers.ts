import type { SplitRow } from "@/lib/consumerBreakdown";
import { mondayOf } from "@/lib/consumerBreakdown";

export type ReportChartMetric = "sampled" | "avg" | "activations";

export interface PriorDateWindow {
  startDate: string;
  endDate: string;
  spanDays: number;
  shortLabel: string;
}

const formatYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseLocalYmd = (v: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  return Number.isNaN(out.getTime()) ? null : out;
};

/**
 * Computes the immediately preceding date window of equal inclusive day length.
 */
export function computePriorDateWindow(
  startDate: string,
  endDate: string,
): PriorDateWindow | null {
  const start = parseLocalYmd(startDate);
  const end = parseLocalYmd(endDate);
  if (!start || !end || end < start) return null;
  const msPerDay = 86_400_000;
  const spanDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / msPerDay) + 1,
  );
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const prevStart = new Date(
    prevEnd.getFullYear(),
    prevEnd.getMonth(),
    prevEnd.getDate() - (spanDays - 1),
  );
  return {
    startDate: formatYmd(prevStart),
    endDate: formatYmd(prevEnd),
    spanDays,
    shortLabel: `prior ${spanDays}d`,
  };
}

export interface DeltaBadge {
  text: string;
  direction: "up" | "down" | "flat";
}

export function formatPercentDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  priorLabel = "prior window",
): DeltaBadge | null {
  if (
    typeof current !== "number" ||
    !Number.isFinite(current) ||
    typeof previous !== "number" ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return null;
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Math.abs(rounded) < 0.5) {
    return { text: `Flat vs ${priorLabel}`, direction: "flat" };
  }
  const sign = rounded > 0 ? "+" : "";
  const formatted = Math.abs(rounded) >= 10 ? Math.round(rounded) : rounded;
  return {
    text: `${sign}${formatted}% vs ${priorLabel}`,
    direction: rounded > 0 ? "up" : "down",
  };
}

export function formatPointDelta(
  currentPct: number | null | undefined,
  previousPct: number | null | undefined,
  priorLabel = "prior window",
): DeltaBadge | null {
  if (
    typeof currentPct !== "number" ||
    !Number.isFinite(currentPct) ||
    typeof previousPct !== "number" ||
    !Number.isFinite(previousPct)
  ) {
    return null;
  }
  const diff = Math.round((currentPct - previousPct) * 10) / 10;
  if (Math.abs(diff) < 0.2) {
    return { text: `Flat vs ${priorLabel}`, direction: "flat" };
  }
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)} pts vs ${priorLabel}`,
    direction: diff > 0 ? "up" : "down",
  };
}

export function metricValueForRow(
  consumers: number,
  recaps: number,
  metric: ReportChartMetric,
): number {
  if (metric === "activations") return Math.max(0, recaps);
  if (metric === "avg") {
    return recaps > 0 ? Math.round(consumers / recaps) : 0;
  }
  return Math.max(0, consumers);
}

export function metricAxisTitle(
  baseNoun: "store" | "state" | "week",
  metric: ReportChartMetric,
): { title: string; measure: string } {
  if (baseNoun === "week") {
    if (metric === "activations") {
      return { title: "Approved activations per week", measure: "Activations" };
    }
    if (metric === "avg") {
      return {
        title: "Avg consumers sampled per activation",
        measure: "Avg sampled / activation",
      };
    }
    return { title: "Consumers sampled per week", measure: "Consumers sampled" };
  }
  const place = baseNoun === "store" ? "store" : "state";
  if (metric === "activations") {
    return {
      title: `Approved activations by ${place}`,
      measure: "Activations",
    };
  }
  if (metric === "avg") {
    return {
      title: `Avg sampled per activation by ${place}`,
      measure: "Avg sampled / activation",
    };
  }
  return {
    title: `Consumers sampled by ${place}`,
    measure: "Consumers sampled",
  };
}

export function transformWeeklyByMetric(
  weeks: ReadonlyArray<{ weekStart: string; consumers: number; recaps: number }>,
  metric: ReportChartMetric,
  today: Date = new Date(),
): { labels: string[]; values: number[]; hasData: boolean } {
  const currentMonday = formatYmd(mondayOf(today));
  const labels = weeks.map((w) => {
    if (w.weekStart === currentMonday) return "This week";
    const [y, m, d] = w.weekStart.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  });
  const values = weeks.map((w) => metricValueForRow(w.consumers, w.recaps, metric));
  return { labels, values, hasData: values.some((v) => v > 0) };
}

export function alignPriorWeeklyValues(
  targetLength: number,
  priorWeeks: ReadonlyArray<{ consumers: number; recaps: number }>,
  metric: ReportChartMetric,
): Array<number | null> {
  if (targetLength <= 0) return [];
  const out: Array<number | null> = [];
  for (let i = 0; i < targetLength; i += 1) {
    const row = priorWeeks[i];
    out.push(row ? metricValueForRow(row.consumers, row.recaps, metric) : null);
  }
  return out;
}

export function transformSplitRowsByMetric(
  rows: ReadonlyArray<{
    label: string;
    kind: string;
    consumers: number;
    recaps: number;
  }>,
  metric: ReportChartMetric,
): SplitRow[] {
  return rows
    .filter((r) => (metric === "avg" ? r.kind === "named" || r.kind === "venue" : true))
    .map((r) => ({
      label: r.label,
      kind: r.kind,
      consumers: metricValueForRow(r.consumers, r.recaps, metric),
    }));
}

export interface ProgramReportExportInput {
  brandName: string;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  consumersSampled: number;
  approvedRecaps: number;
  unitsSold: number;
  conversionPct: number | null;
  eventsRun: number;
  samplesPerHour: number | null;
  unitsPerHour: number | null;
  byWeek: ReadonlyArray<{ weekStart: string; consumers: number; recaps: number }>;
  byStore: ReadonlyArray<{ label: string; kind: string; consumers: number; recaps: number }>;
  byState: ReadonlyArray<{ label: string; kind: string; consumers: number; recaps: number }>;
  skus: ReadonlyArray<{ product: string; samples: number }>;
  topEfficiencyStores: ReadonlyArray<{
    label: string;
    recaps: number;
    sold: number;
    samplesPerHour?: number | null;
    unitsPerHour?: number | null;
  }>;
}

const csvCell = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function buildProgramReportCsv(input: ProgramReportExportInput): string {
  const lines: string[] = [];
  const row = (...cells: Array<string | number | null | undefined>) => {
    lines.push(cells.map(csvCell).join(","));
  };

  row("Program Performance Report", input.brandName);
  row("Window", `${input.rangeLabel} (${input.startDate} to ${input.endDate})`);
  lines.push("");

  row("Summary Metric", "Value");
  row("Consumers Sampled", input.consumersSampled);
  row("Approved Recaps", input.approvedRecaps);
  row("Units Sold (Retail & On-Premise)", input.unitsSold);
  row(
    "Conversion %",
    input.conversionPct != null ? `${input.conversionPct.toFixed(1)}%` : "",
  );
  row("Events Run", input.eventsRun);
  if (input.samplesPerHour != null) {
    row("Samples / Staffed Hour", input.samplesPerHour.toFixed(1));
  }
  if (input.unitsPerHour != null) {
    row("Units Sold / Staffed Hour", input.unitsPerHour.toFixed(1));
  }
  lines.push("");

  if (input.byWeek.length > 0) {
    row("Week Starting", "Consumers Sampled", "Approved Recaps", "Avg / Recap");
    for (const w of input.byWeek) {
      row(
        w.weekStart,
        w.consumers,
        w.recaps,
        w.recaps > 0 ? Math.round(w.consumers / w.recaps) : 0,
      );
    }
    lines.push("");
  }

  const namedStores = input.byStore.filter(
    (s) => (s.kind === "named" || s.kind === "venue") && s.consumers > 0,
  );
  if (namedStores.length > 0) {
    row("Store / Venue", "Consumers Sampled", "Approved Recaps", "Avg / Recap");
    for (const s of namedStores) {
      row(
        s.label,
        s.consumers,
        s.recaps,
        s.recaps > 0 ? Math.round(s.consumers / s.recaps) : 0,
      );
    }
    lines.push("");
  }

  const namedStates = input.byState.filter(
    (s) => s.kind === "named" && s.consumers > 0,
  );
  if (namedStates.length > 0) {
    row("State", "Consumers Sampled", "Approved Recaps");
    for (const s of namedStates) {
      row(s.label, s.consumers, s.recaps);
    }
    lines.push("");
  }

  if (input.skus.length > 0) {
    row("Product / SKU", "Samples Handed Out");
    for (const p of input.skus) {
      row(p.product, p.samples);
    }
    lines.push("");
  }

  if (input.topEfficiencyStores.length > 0) {
    row("Store (Sales Velocity)", "Activations", "Units Sold", "Samples / Hr", "Sold / Hr");
    for (const st of input.topEfficiencyStores) {
      row(
        st.label,
        st.recaps,
        st.sold,
        st.samplesPerHour != null ? st.samplesPerHour.toFixed(1) : "",
        st.unitsPerHour != null ? st.unitsPerHour.toFixed(1) : "",
      );
    }
  }

  return lines.join("\n");
}

export function buildProgramExecutiveBrief(input: ProgramReportExportInput): string {
  const convStr =
    input.conversionPct != null ? `${input.conversionPct.toFixed(1)}%` : "—";
  const topStores = input.byStore
    .filter((s) => s.kind === "named" && s.consumers > 0)
    .slice(0, 5);
  const topStates = input.byState
    .filter((s) => s.kind === "named" && s.consumers > 0)
    .slice(0, 5);
  const topSkus = input.skus.slice(0, 4);

  const lines: string[] = [
    `${input.brandName} — Program Report (${input.rangeLabel}: ${input.startDate} → ${input.endDate})`,
    `• Consumers sampled: ${input.consumersSampled.toLocaleString("en-US")} across ${input.approvedRecaps.toLocaleString("en-US")} approved recaps`,
    `• Retail & on-premise units sold: ${input.unitsSold.toLocaleString("en-US")} (${convStr} conversion)`,
    `• Events run: ${input.eventsRun.toLocaleString("en-US")}`,
  ];

  if (input.samplesPerHour != null || input.unitsPerHour != null) {
    const rateParts = [
      input.samplesPerHour != null
        ? `${input.samplesPerHour.toFixed(1)} samples/hr`
        : null,
      input.unitsPerHour != null
        ? `${input.unitsPerHour.toFixed(1)} units sold/hr`
        : null,
    ].filter(Boolean);
    lines.push(`• Hourly velocity: ${rateParts.join(" · ")}`);
  }

  if (topStores.length > 0) {
    lines.push(
      `• Top accounts: ${topStores
        .map((s) => `${s.label} (${s.consumers.toLocaleString("en-US")})`)
        .join(", ")}`,
    );
  }
  if (topStates.length > 0) {
    lines.push(
      `• Top markets: ${topStates
        .map((s) => `${s.label} (${s.consumers.toLocaleString("en-US")})`)
        .join(", ")}`,
    );
  }
  if (topSkus.length > 0) {
    lines.push(
      `• Leading SKUs: ${topSkus
        .map((p) => `${p.product} (${p.samples.toLocaleString("en-US")})`)
        .join(", ")}`,
    );
  }

  return lines.join("\n");
}
