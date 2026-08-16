export type SparkStatTone = "default" | "lime" | "orange";

export type SparkStatItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: SparkStatTone;
};

/**
 * Recaps list strip — numbers from the loaded/filtered set, never invented.
 * Conv is sold ÷ engagements when both are real and engagements > 0.
 */
export function recapListKpis(input: {
  filteredTotal: number;
  loaded: number;
  total: number;
  engagements: number;
  sold: number;
}): SparkStatItem[] {
  const hasConv = input.engagements > 0 && input.sold > 0;
  const conv = hasConv
    ? `${Math.round((input.sold / input.engagements) * 100)}%`
    : "—";
  return [
    {
      label: "In view",
      value: input.filteredTotal.toLocaleString(),
      hint:
        input.loaded < input.total
          ? `${input.loaded.toLocaleString()} loaded`
          : undefined,
    },
    {
      label: "Eng",
      value: input.engagements.toLocaleString(),
      tone: "lime",
    },
    {
      label: "Sold",
      value: input.sold.toLocaleString(),
    },
    {
      label: "Conv",
      value: conv,
      tone: hasConv ? "lime" : "default",
    },
  ];
}

/** Today map + roster — events / live pings / mapped venues. */
export function todayGroundKpis(input: {
  events: number;
  liveBas: number;
  mapped: number;
}): SparkStatItem[] {
  return [
    { label: "Events", value: input.events.toLocaleString() },
    {
      label: "Live BAs",
      value: input.liveBas.toLocaleString(),
      tone: input.liveBas > 0 ? "orange" : "default",
    },
    {
      label: "Mapped",
      value: input.mapped.toLocaleString(),
      tone: "lime",
    },
  ];
}

export function padIndex(n: number): string {
  return String(n).padStart(2, "0");
}
