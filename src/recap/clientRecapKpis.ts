import { recapConversion } from "@/shared/sparkStat";

export type ClientRecapKpi = { label: string; value: string };

/**
 * Honest client-facing numbers for a recap review.
 * ENG / SOLD / CONV when we have them; otherwise sampled + photo count.
 * CONV is sold ÷ consumers sampled (engagements only when no sampled count
 * is logged) and only for Retail / On-Premise — never for Event activations.
 * Dry demos use that same denominator. Never invents a conversion from
 * missing sold or a zero base.
 */
export function clientRecapKpis(input: {
  engagements: number | null | undefined;
  consumersSampled?: number | null | undefined;
  soldUnits: number | null | undefined;
  unitsSampled: number | null | undefined;
  photoCount: number;
  activationType?: string | null | undefined;
  /** Kept so callers can pass the flag. CONV does not use it. */
  isDryDemo?: boolean | null | undefined;
  /** People pitched. Not the conversion denominator. */
  peopleEngaged?: number | null | undefined;
  /** Template copy for the per-SKU total, e.g. "Total cans sampled". */
  unitsSampledLabel?: string;
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
  const conv = recapConversion({
    requestType: input.activationType,
    recapType: input.activationType == null ? "retail" : undefined,
    engagements: input.engagements,
    consumersSampled: input.consumersSampled,
    productsSold: input.soldUnits,
  });
  if (conv.applies) {
    out.push({ label: "Conv", value: `${conv.pct}%` });
  } else if (typeof input.unitsSampled === "number" && input.unitsSampled > 0) {
    out.push({
      label: input.unitsSampledLabel || "Sampled",
      value: input.unitsSampled.toLocaleString(),
    });
  }
  out.push({ label: "Photos", value: String(input.photoCount) });
  return out.slice(0, 4);
}
