export interface TypicalWeeksScale {
  /** Highest raw value across all weeks. */
  max: number;
  /** Clean rounded ceiling for the Y-axis in Typical weeks mode. */
  axisMax: number;
  /** Clean round tick interval dividing axisMax into 3–5 steps. */
  stepSize: number;
  /** Indices of weeks that exceed axisMax. */
  outlierIndices: number[];
  /** Label of the highest week (e.g. "Nov 2"). */
  peakLabel: string;
  /** Primary series with outlier weeks nulled out so splines don't distort neighbors. */
  typicalData: Array<number | null>;
  /** Dashed connector series bridging each outlier week to its immediate neighbors. */
  connectorData: Array<number | null>;
}

/**
 * Picks a clean round Y-axis ceiling and tick step above `target`
 * so ticks are human numbers (e.g. 0, 1,000, 2,000, 3,000, 4,000, 5,000)
 * and never collide like 4,000 + 4,617.
 */
export function niceAxisCeiling(target: number): {
  axisMax: number;
  stepSize: number;
} {
  const safe = Math.max(10, target);
  const exp = Math.floor(Math.log10(safe / 4));
  const mag = Math.pow(10, Math.max(0, exp));
  const multipliers = mag >= 100 ? [1, 2, 2.5, 5, 10, 20] : [1, 2, 5, 10, 20];

  for (const m of multipliers) {
    const step = Math.max(1, Math.round(m * mag));
    const intervals = Math.ceil(safe / step);
    if (intervals >= 3 && intervals <= 5) {
      return { axisMax: intervals * step, stepSize: step };
    }
  }

  const fallbackStep = Math.max(5, Math.ceil(safe / 4));
  return { axisMax: fallbackStep * 4, stepSize: fallbackStep };
}

export function computeTypicalWeeksScale(
  values: readonly number[],
  labels: readonly string[],
): TypicalWeeksScale | null {
  const pos = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (pos.length < 3) return null;

  const max = pos[pos.length - 1];
  const median = pos[Math.floor(pos.length / 2)];
  if (median <= 0 || max < median * 4) return null;

  // Exclude extreme event spikes (> 65% of peak and > 4x median) when sizing typical weeks.
  const typicalCandidates = pos.filter(
    (v) => v < max && !(v > median * 4 && v > max * 0.65),
  );
  const refMax =
    typicalCandidates.length > 0
      ? typicalCandidates[typicalCandidates.length - 1]
      : median * 2;

  const { axisMax, stepSize } = niceAxisCeiling(refMax * 1.15);
  if (axisMax >= max) return null;

  const outlierSet = new Set<number>();
  values.forEach((v, idx) => {
    if (v > axisMax) outlierSet.add(idx);
  });
  if (outlierSet.size === 0) return null;

  const typicalData = values.map((v) => (v > axisMax ? null : v));
  const connectorData = values.map((v, idx) => {
    if (outlierSet.has(idx)) return axisMax;
    if (outlierSet.has(idx - 1) || outlierSet.has(idx + 1)) return v;
    return null;
  });

  const peakIdx = values.indexOf(max);
  return {
    max,
    axisMax,
    stepSize,
    outlierIndices: [...outlierSet],
    peakLabel: peakIdx >= 0 ? (labels[peakIdx] ?? "Peak week") : "Peak week",
    typicalData,
    connectorData,
  };
}
