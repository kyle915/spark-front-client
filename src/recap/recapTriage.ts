/**
 * Clean vs Needs Eyes triage helpers for the admin Needs-review list.
 * Labels come from staff-only `recapReviewTriage`; never expose to clients.
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

export function recapTriageLabelForId(
  byId: Map<string, RecapTriageSummary> | null | undefined,
  id: string,
): RecapTriageLabel {
  return byId?.get(id)?.label ?? "clean";
}

export function recapMatchesTriageFilter(
  filter: RecapTriageFilter,
  label: RecapTriageLabel,
): boolean {
  if (filter === "all") return true;
  return filter === label;
}

export function countRecapTriage(
  ids: readonly string[],
  byId: Map<string, RecapTriageSummary> | null | undefined,
): { clean: number; needsEyes: number } {
  let clean = 0;
  let needsEyes = 0;
  for (const id of ids) {
    if (recapTriageLabelForId(byId, id) === "needs_eyes") needsEyes += 1;
    else clean += 1;
  }
  return { clean, needsEyes };
}

/** Sort Needs Eyes ahead of Clean (stable within each bucket). */
export function compareRecapTriage(
  aId: string,
  bId: string,
  byId: Map<string, RecapTriageSummary> | null | undefined,
): number {
  const a = recapTriageLabelForId(byId, aId) === "needs_eyes" ? 0 : 1;
  const b = recapTriageLabelForId(byId, bId) === "needs_eyes" ? 0 : 1;
  return a - b;
}
