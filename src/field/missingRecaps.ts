/** Tenants where Missing Recaps (sidebar + /recaps/missing) stays off. */
const MISSING_RECAPS_OFF = new Set(["famus-energy"]);

export function showsMissingRecaps(
  slug: string | null | undefined,
  requestUrlName?: string | null,
): boolean {
  return ![slug, requestUrlName].some((value) =>
    MISSING_RECAPS_OFF.has((value || "").trim().toLowerCase()),
  );
}
