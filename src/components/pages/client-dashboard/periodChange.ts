/**
 * "up from 1,210 in the 30 days before" — how a headline figure moved
 * against the window before it.
 *
 * Stated as the two real numbers, never as a percentage: a brand that went
 * from 3 events to 12 did not "grow 300%" in any way worth printing. Says
 * nothing when the earlier window had no events to compare against.
 */
export function periodChange(input: {
  current: number | null | undefined;
  previous: number | null | undefined;
  /** Events in the earlier window; 0 means there is nothing to compare. */
  previousEvents: number | null | undefined;
  format: (n: number) => string;
  days: number;
}): string | null {
  const { current, previous, previousEvents, format, days } = input;
  if (typeof current !== "number" || typeof previous !== "number") return null;
  if (!previousEvents || previousEvents <= 0) return null;
  const before = `the ${days} days before`;
  const shownNow = format(current);
  const shownThen = format(previous);
  // Compare what is printed, so 61.6% vs 62.4% (both "62%") reads as level.
  if (shownNow === shownThen) return `same as ${before}`;
  return `${current > previous ? "up" : "down"} from ${shownThen} in ${before}`;
}
