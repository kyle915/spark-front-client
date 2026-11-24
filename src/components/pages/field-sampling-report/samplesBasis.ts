/**
 * What the Field Sampling Report headline counted (`samplesPerHour.basis`
 * from spark-api): "units" is the sum of the SKU rows printed under it;
 * the free-text fallbacks only apply when the window has no per-SKU
 * quantities. Labels follow the basis so the headline never reads as a
 * different number from the rows below it.
 */
export type SamplesBasis = "units" | "samples_given" | "consumers" | "none";

export function samplesBasisLabels(basis: string | null | undefined): {
  total: string;
  perHour: string;
  note: string | null;
} {
  switch (basis) {
    case "consumers":
      return {
        total: "Consumers sampled (window)",
        perHour: "Consumers / hour",
        note: "No per-SKU counts in this window, so this counts consumers sampled from the recaps.",
      };
    case "samples_given":
      return {
        total: "Samples (window)",
        perHour: "Samples / hour",
        note: "No per-SKU counts in this window, so this uses the samples-given number on each recap.",
      };
    default:
      return { total: "Samples (window)", perHour: "Samples / hour", note: null };
  }
}
