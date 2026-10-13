/** Selected sibling brands → their SKU ids (from each brand's own catalog). */
export type CoBrandSelection = Record<string, string[]>;

export function coBrandsPayload(
  enabled: boolean,
  selection: CoBrandSelection,
): { tenantId: string; productIds: string[] }[] {
  if (!enabled) return [];
  return Object.entries(selection).map(([tenantId, productIds]) => ({
    tenantId,
    productIds,
  }));
}

/** "" when complete, else what's missing (for the sticky submit blocker). */
export function coBrandBlocker(
  enabled: boolean | null,
  selection: CoBrandSelection,
): string {
  if (enabled === null) return "Multi-brand";
  if (!enabled) return "";
  const picked = Object.values(selection);
  if (picked.length === 0) return "Brands";
  return picked.some((ids) => ids.length === 0) ? "Brand SKUs" : "";
}
