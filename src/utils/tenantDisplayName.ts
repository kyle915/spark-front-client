/**
 * Human-readable client name from the tenant's public slug.
 *
 * Request-form slugs carry a 4-character code prefix
 * ("gfkv-pivot-energy-drink"); the plain tenant slug does not
 * ("pivot-energy-drink"). Either way the result is "Pivot Energy Drink".
 */
export function tenantDisplayName(
  requestUrlName: string | null | undefined,
  tenantSlug?: string | null,
): string {
  const raw = (tenantSlug || requestUrlName || "").trim().toLowerCase();
  if (!raw) return "";
  let slug = raw;
  // Only strip the code prefix when we fell back to the request-form slug.
  if (!tenantSlug && /^[a-z0-9]{4}-.+/.test(slug)) slug = slug.slice(5);
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && /^[a-z]+$/.test(w) && SHORT_UPPER.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const SHORT_UPPER = new Set(["thc", "ld", "tw", "usa"]);
