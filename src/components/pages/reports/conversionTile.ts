/** The conversion tile. A sampled base with no sales is 0%, not a blank. */
export function conversionFigure(
  sold: number,
  sampled: number,
  pct: number | null | undefined,
): string {
  if (sampled <= 0) return "—";
  if (typeof pct === "number" && Number.isFinite(pct)) return `${Math.round(pct)}%`;
  if (sold === 0) return "0%";
  return "—";
}
