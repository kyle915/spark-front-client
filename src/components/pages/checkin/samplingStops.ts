import { normalizeTenantKey } from "@/layout/tenantLogo";

/**
 * Walk-up tenants that sit at one store (Torch at Total Wine) do not log
 * roaming sample stops. Feel Free and other market-mode crews do.
 *
 * Matches the public form slug `keee-torch-thc` and the shorter `torch-thc`
 * token used on clocked-in links like TH-*.
 */
const TORCH_WALKUP_KEYS = new Set(["keeetorchthc", "torchthc", "torch"]);

export function isTorchWalkupBrand(brand: {
  name?: string | null;
  requestUrlName?: string | null;
}): boolean {
  const slug = (brand.requestUrlName ?? "").trim().toLowerCase();
  if (slug === "keee-torch-thc" || slug === "torch-thc") return true;
  for (const raw of [brand.requestUrlName, brand.name]) {
    if (TORCH_WALKUP_KEYS.has(normalizeTenantKey(raw))) return true;
  }
  return false;
}

/** Clocked-in roaming crews get the "Where are you sampling?" stop card. */
export function shouldShowSamplingStopCard(opts: {
  clockState: string;
  locationMode?: string | null;
  brand: { name?: string | null; requestUrlName?: string | null };
}): boolean {
  if (opts.clockState !== "clocked_in") return false;
  if (isTorchWalkupBrand(opts.brand)) return false;
  return opts.locationMode === "market";
}
