/**
 * The recaps list selection, independent of the current filter.
 *
 * A selection survives filter changes: tick three recaps, switch retailer,
 * tick two more. The bulk actions used to act on "selected AND on screen
 * now" while the bar said "5 SELECTED", so Approve could quietly approve 2
 * and report 5. Every bulk action now reads the rows remembered here, so it
 * acts on exactly what the bar counts.
 */
export type SelectableRecap = {
  id: string;
  kind: "legacy" | "custom";
};

/**
 * The selected rows: on-screen ones first, in screen order (the campaign
 * report's cover order), then the off-screen picks in the order they were
 * ticked. An on-screen row wins over its remembered copy, so its current
 * state (approved / archived) is what the actions see.
 */
export function selectedRows<T extends SelectableRecap>(
  selection: ReadonlyMap<string, T>,
  onScreen: readonly T[],
): T[] {
  if (selection.size === 0) return [];
  const visible = onScreen.filter((r) => selection.has(r.id));
  const seen = new Set(visible.map((r) => r.id));
  const offScreen = [...selection.values()].filter((r) => !seen.has(r.id));
  return [...visible, ...offScreen];
}

/** Relay ids split by recap kind, for the bulk mutations. */
export function idsByKind(rows: readonly SelectableRecap[]): {
  recapIds: string[];
  customRecapIds: string[];
} {
  const recapIds: string[] = [];
  const customRecapIds: string[] = [];
  for (const r of rows) {
    if (r.kind === "custom") customRecapIds.push(r.id);
    else recapIds.push(r.id);
  }
  return { recapIds, customRecapIds };
}

/**
 * The toast after a bulk approve. `requested` is how many recaps were sent;
 * `approved` is the server's count of the ones it actually approved.
 */
export function bulkApproveMessage(input: {
  requested: number;
  approved: number;
  /** The one recap's label, when exactly one was sent. */
  singleLabel?: string | null;
  /** The server's reason, shown when some could not be approved. */
  reason?: string | null;
}): { text: string; tone: "success" | "warning" | "error" } {
  const { requested, approved, singleLabel, reason } = input;
  const failed = Math.max(0, requested - approved);
  if (approved === 0) {
    return {
      text: reason?.trim() || "Bulk approve failed.",
      tone: "error",
    };
  }
  if (failed === 0) {
    return {
      text:
        requested === 1 && singleLabel
          ? `Approved · ${singleLabel}`
          : `Approved · ${approved}`,
      tone: "success",
    };
  }
  const why = reason?.trim() ? ` ${reason.trim()}` : "";
  return {
    text: `Approved ${approved} of ${requested}. ${failed} couldn't be approved.${why}`,
    tone: "warning",
  };
}
