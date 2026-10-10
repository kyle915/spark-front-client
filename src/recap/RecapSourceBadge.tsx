/** Who filed a recap when it isn't a Spark BA on the clock — e.g. "Submitted
 *  by Torch team" from the brand's client-team recap link. Unlike the 3rd
 *  party chip these recaps count in totals, so the chip only names the
 *  source. List + detail, admin + client. Renders nothing when unset. */
export function RecapSourceBadge({
  label,
  compact = false,
}: {
  label?: string | null;
  compact?: boolean;
}) {
  const text = (label ?? "").trim();
  if (!text) return null;
  return <span className={`chip chip-sky ${compact ? "chip-sm" : ""}`}>{text}</span>;
}
