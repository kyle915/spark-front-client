/** Tenants where Missing Recaps (sidebar + /recaps/missing) stays off.

Empty after Famus Matching debt was parked (API accepted orphans +
fuzzy folds). Re-add a slug only if false DUE shells return for that
tenant.
*/
const MISSING_RECAPS_OFF = new Set<string>([]);

export function showsMissingRecaps(
  slug: string | null | undefined,
  requestUrlName?: string | null,
): boolean {
  return ![slug, requestUrlName].some((value) =>
    MISSING_RECAPS_OFF.has((value || "").trim().toLowerCase()),
  );
}
