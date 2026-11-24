/**
 * Sampling programs often log one headcount three ways: consumers
 * reached, samples distributed, and engagements. The API also copies
 * consumers_reached into samples_distributed when no separate sample
 * count exists (one sample per person). Showing 1,060 three times is
 * a lie — collapse identical values into one "consumers sampled" tile.
 */

export type SamplingTotals = {
  consumersReached: number;
  samplesDistributed: number;
  totalEngagements: number;
};

export type SamplingTile = {
  label: string;
  value: number;
  key: "consumersSampled" | "samplesDistributed" | "totalEngagements";
  /** One line saying why this figure can sit below another. */
  note?: string;
};

/**
 * "Total engagements" is the number box on the recap form, which only some
 * forms ask for and BAs sometimes leave blank, while consumers sampled is
 * read from every recap. When engagements come out BELOW consumers sampled
 * (Liquid Death: 209,440 vs 213,128) "Total engagements" reads as a
 * contradiction — you can't sample more people than you engaged. It is
 * labelled for what it is instead.
 */
export const PARTIAL_ENGAGEMENTS_LABEL = "Engagements logged";
export const PARTIAL_ENGAGEMENTS_NOTE = "Only on recaps whose form asks for it";

export function collapseSamplingKpis(k: SamplingTotals): SamplingTile[] {
  const reached = k.consumersReached ?? 0;
  const samples = k.samplesDistributed ?? 0;
  const engagements = k.totalEngagements ?? 0;

  const sampled = reached || samples || engagements;
  const samplesDistinct = samples > 0 && samples !== sampled;
  const engagementsDistinct = engagements > 0 && engagements !== sampled;

  const tiles: SamplingTile[] = [
    { key: "consumersSampled", label: "Consumers sampled", value: sampled },
  ];
  if (samplesDistinct) {
    tiles.push({
      key: "samplesDistributed",
      // Distinct unit count only — never the consumers-sampled mirror.
      label: "Samples handed out",
      value: samples,
    });
  }
  if (engagementsDistinct) {
    const partial = engagements < sampled;
    tiles.push({
      key: "totalEngagements",
      label: partial ? PARTIAL_ENGAGEMENTS_LABEL : "Total engagements",
      value: engagements,
      ...(partial ? { note: PARTIAL_ENGAGEMENTS_NOTE } : {}),
    });
  }
  return tiles;
}

export function previousForSamplingTile(
  tile: SamplingTile,
  previous: SamplingTotals,
): number {
  if (tile.key === "samplesDistributed") return previous.samplesDistributed ?? 0;
  if (tile.key === "totalEngagements") return previous.totalEngagements ?? 0;
  return (
    previous.consumersReached ||
    previous.samplesDistributed ||
    previous.totalEngagements ||
    0
  );
}
