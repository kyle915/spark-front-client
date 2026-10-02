import { countsTowardConversion } from "@/lib/activationBucket";

export type ClientRecapKpi = { label: string; value: string };

/**
 * Honest client-facing numbers for a recap review.
 * ENG / SOLD / CONV when we have them; otherwise sampled + photo count.
 * CONV is sold ÷ consumers sampled (engagements only when no sampled count
 * is logged) and only for Retail / On-Premise — never for Event activations.
 * Never invents a conversion from missing sold or a zero base. Dry demos
 * (no product tasted) are labelled and divide by People engaged (else the
 * consumers-sampled value) instead.
 */
export function clientRecapKpis(input: {
  engagements: number | null | undefined;
  consumersSampled?: number | null | undefined;
  soldUnits: number | null | undefined;
  unitsSampled: number | null | undefined;
  photoCount: number;
  activationType?: string | null | undefined;
  isDryDemo?: boolean | null | undefined;
  peopleEngaged?: number | null | undefined;
}): ClientRecapKpi[] {
  const out: ClientRecapKpi[] = [];
  if (input.isDryDemo) {
    const pitched = input.peopleEngaged || input.consumersSampled || 0;
    if (pitched > 0) {
      out.push({
        label: "Dry demo · people engaged",
        value: pitched.toLocaleString(),
      });
    } else {
      out.push({ label: "Dry demo", value: "No tasting" });
    }
    if (typeof input.soldUnits === "number") {
      out.push({ label: "Sold", value: input.soldUnits.toLocaleString() });
    }
    const convEligible =
      input.activationType === undefined ||
      countsTowardConversion(input.activationType);
    if (convEligible && typeof input.soldUnits === "number" && pitched > 0) {
      const pct = Math.round((input.soldUnits / pitched) * 1000) / 10;
      out.push({
        label: "Conv · vs. people engaged (dry demo)",
        value: `${pct}%`,
      });
    }
    out.push({ label: "Photos", value: String(input.photoCount) });
    return out.slice(0, 4);
  }
  if (typeof input.engagements === "number") {
    out.push({
      label: "Engagements",
      value: input.engagements.toLocaleString(),
    });
  }
  if (typeof input.soldUnits === "number") {
    out.push({ label: "Sold", value: input.soldUnits.toLocaleString() });
  }
  const base =
    typeof input.consumersSampled === "number"
      ? input.consumersSampled
      : input.engagements;
  const convEligible =
    input.activationType === undefined ||
    countsTowardConversion(input.activationType);
  if (
    convEligible &&
    typeof input.soldUnits === "number" &&
    typeof base === "number" &&
    base > 0
  ) {
    const pct = Math.round((input.soldUnits / base) * 1000) / 10;
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
