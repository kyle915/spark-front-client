/** Visible source label for recaps filed via a tenant's recap-only
 *  (3rd-party / external agency) check-in link. Not the same as an
 *  "(external)" BA write-in — those are walk-up people who aren't in
 *  Spark yet. Keep this chip loud: list + detail, admin + client.
 *  `notInTotals`: the recap is kept out of every aggregate (Insights,
 *  list strip, dashboards) — say so, so its numbers aren't confusing. */
export function ThirdPartyRecapBadge({
  compact = false,
  notInTotals = false,
  onPhoto = false,
}: {
  compact?: boolean;
  notInTotals?: boolean | null;
  /** Sits on top of a photo: the tinted chip disappears against a busy
   *  image, so give it a solid ground and white text. */
  onPhoto?: boolean;
}) {
  return (
    <span
      className={`chip chip-purple ${compact ? "chip-sm" : ""}`}
      title={notInTotals ? "Listed here, but its numbers are left out of every total" : undefined}
      style={
        onPhoto
          ? {
              background: "#4b3a94",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "#ffffff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }
          : undefined
      }
    >
      {notInTotals ? "3rd party · not in totals" : compact ? "3rd Party" : "3rd Party Recap"}
    </span>
  );
}
