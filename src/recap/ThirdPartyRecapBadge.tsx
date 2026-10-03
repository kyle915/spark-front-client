/** Visible source label for recaps filed via a tenant's recap-only
 *  (3rd-party / external agency) check-in link. Not the same as an
 *  "(external)" BA write-in — those are walk-up people who aren't in
 *  Spark yet. Keep this chip loud: list + detail, admin + client.
 *  `notInTotals`: the recap is kept out of every aggregate (Insights,
 *  list strip, dashboards) — say so, so its numbers aren't confusing. */
export function ThirdPartyRecapBadge({
  compact = false,
  notInTotals = false,
}: {
  compact?: boolean;
  notInTotals?: boolean | null;
}) {
  return (
    <span
      className={`chip chip-purple ${compact ? "chip-sm" : ""}`}
      title={notInTotals ? "Listed here, but its numbers are left out of every total" : undefined}
    >
      {notInTotals ? "3rd party · not in totals" : compact ? "3rd Party" : "3rd Party Recap"}
    </span>
  );
}
