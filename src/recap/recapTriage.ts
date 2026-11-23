/**
 * Clean vs Needs Eyes triage helpers for the admin Needs-review list.
 * Labels come from staff-only `recapReviewTriage`; never expose to clients.
 *
 * Missing / pending / failed triage must NOT default to Clean for approve
 * or for Clean/Needs Eyes filters — only an explicit server label counts.
 */

export type RecapTriageLabel = "clean" | "needs_eyes";

export type RecapTriageFilter = "all" | RecapTriageLabel;

export type RecapTriageReason = {
  code: string;
  label: string;
  source: string;
};

export type RecapTriageSummary = {
  label: RecapTriageLabel;
  reasons: RecapTriageReason[];
};

export function parseRecapTriageLabel(
  raw: string | null | undefined,
): RecapTriageLabel {
  return raw === "needs_eyes" ? "needs_eyes" : "clean";
}

/** Explicit server label, or null when triage has not resolved this id. */
export function resolvedRecapTriageLabel(
  byId: Map<string, RecapTriageSummary> | null | undefined,
  id: string,
): RecapTriageLabel | null {
  const row = byId?.get(id);
  return row ? row.label : null;
}

/** @deprecated Prefer resolvedRecapTriageLabel — missing is not Clean. */
export function recapTriageLabelForId(
  byId: Map<string, RecapTriageSummary> | null | undefined,
  id: string,
): RecapTriageLabel {
  return resolvedRecapTriageLabel(byId, id) ?? "clean";
}

export function isRecapExplicitlyClean(
  byId: Map<string, RecapTriageSummary> | null | undefined,
  id: string,
): boolean {
  return resolvedRecapTriageLabel(byId, id) === "clean";
}

export function recapMatchesTriageFilter(
  filter: RecapTriageFilter,
  label: RecapTriageLabel | null,
): boolean {
  if (filter === "all") return true;
  // Unresolved rows stay hidden on Clean / Needs Eyes until the map lands.
  if (label == null) return false;
  return filter === label;
}

export function countRecapTriage(
  ids: readonly string[],
  byId: Map<string, RecapTriageSummary> | null | undefined,
): { clean: number; needsEyes: number; pending: number; complete: boolean } {
  let clean = 0;
  let needsEyes = 0;
  let pending = 0;
  for (const id of ids) {
    const label = resolvedRecapTriageLabel(byId, id);
    if (label === "needs_eyes") needsEyes += 1;
    else if (label === "clean") clean += 1;
    else pending += 1;
  }
  return {
    clean,
    needsEyes,
    pending,
    complete: ids.length === 0 || pending === 0,
  };
}

/**
 * Sort Needs Eyes ahead of Clean. Unresolved stay after Needs Eyes so
 * humans still see exceptions first while triage finishes.
 */
export function compareRecapTriage(
  aId: string,
  bId: string,
  byId: Map<string, RecapTriageSummary> | null | undefined,
): number {
  const rank = (id: string) => {
    const label = resolvedRecapTriageLabel(byId, id);
    if (label === "needs_eyes") return 0;
    if (label == null) return 1;
    return 2;
  };
  return rank(aId) - rank(bId);
}
