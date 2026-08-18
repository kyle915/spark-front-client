/** Visible source label for recaps filed via a tenant's recap-only
 *  (3rd-party / external agency) check-in link. Not the same as an
 *  "(external)" BA write-in — those are walk-up people who aren't in
 *  Spark yet. Keep this chip loud: list + detail, admin + client. */
export function ThirdPartyRecapBadge({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span className={`chip chip-purple ${compact ? "chip-sm" : ""}`}>
      {compact ? "3rd Party" : "3rd Party Recap"}
    </span>
  );
}
