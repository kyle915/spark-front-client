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
};

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
    tiles.push({
      key: "totalEngagements",
      label: "Total engagements",
      value: engagements,
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
