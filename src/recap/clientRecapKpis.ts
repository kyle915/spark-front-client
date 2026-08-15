export type ClientRecapKpi = { label: string; value: string };

/**
 * Honest client-facing numbers for a recap review.
 * ENG / SOLD / CONV when we have them; otherwise sampled + photo count.
 * Never invents a conversion from missing sold or zero engagements.
 */
export function clientRecapKpis(input: {
  engagements: number | null | undefined;
  soldUnits: number | null | undefined;
  unitsSampled: number | null | undefined;
  photoCount: number;
}): ClientRecapKpi[] {
  const out: ClientRecapKpi[] = [];
  if (typeof input.engagements === "number") {
    out.push({
      label: "Engagements",
      value: input.engagements.toLocaleString(),
    });
  }
  if (typeof input.soldUnits === "number") {
    out.push({ label: "Sold", value: input.soldUnits.toLocaleString() });
  }
  if (
    typeof input.soldUnits === "number" &&
    typeof input.engagements === "number" &&
    input.engagements > 0
  ) {
    const pct = Math.round((input.soldUnits / input.engagements) * 1000) / 10;
    out.push({ label: "Conv", value: `${pct}%` });
  } else if (typeof input.unitsSampled === "number" && input.unitsSampled > 0) {
    out.push({
      label: "Sampled",
      value: input.unitsSampled.toLocaleString(),
    });
  }
  out.push({ label: "Photos", value: String(input.photoCount) });
  return out.slice(0, 4);
}
