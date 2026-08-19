import { normalizeTenantKey } from "@/layout/tenantLogo";

/**
 * Walk-up tenants that sit at one store (Torch at Total Wine) do not log
 * roaming sample stops. Feel Free and other market-mode crews do.
 *
 * Matches the public form slug `keee-torch-thc` and the shorter `torch-thc`
 * token used on clocked-in links like TH-*.
 */
const TORCH_WALKUP_KEYS = new Set(["keeetorchthc", "torchthc", "torch"]);
const FEEL_FREE_WALKUP_KEYS = new Set(["feelfree", "bl00feelfree"]);

export type WalkupBrand = {
  name?: string | null;
  requestUrlName?: string | null;
};

export function isTorchWalkupBrand(brand: WalkupBrand): boolean {
  const slug = (brand.requestUrlName ?? "").trim().toLowerCase();
  if (slug === "keee-torch-thc" || slug === "torch-thc") return true;
  for (const raw of [brand.requestUrlName, brand.name]) {
    if (TORCH_WALKUP_KEYS.has(normalizeTenantKey(raw))) return true;
  }
  return false;
}

/** Feel Free Tampa / St. Pete is a market, not a store. */
export function isFeelFreeWalkupBrand(brand: WalkupBrand): boolean {
  const slug = (brand.requestUrlName ?? "").trim().toLowerCase();
  if (slug === "bl00-feel-free" || slug === "feel-free") return true;
  for (const raw of [brand.requestUrlName, brand.name]) {
    if (FEEL_FREE_WALKUP_KEYS.has(normalizeTenantKey(raw))) return true;
  }
  return false;
}

/**
 * Clocked-in roaming crews get the "Where are you sampling?" / Log this stop
 * card. Torch store sampling never does.
 *
 * Feel Free is always included once on the clock: the standing-link session
 * payload historically omitted `locationMode`, which hid this card even
 * though live FF-YMMK3Q is market mode.
 */
export function shouldShowSamplingStopCard(opts: {
  clockState: string;
  locationMode?: string | null;
  brand: WalkupBrand;
}): boolean {
  if (opts.clockState !== "clocked_in") return false;
  if (isTorchWalkupBrand(opts.brand)) return false;
  if (isFeelFreeWalkupBrand(opts.brand)) return true;
  return opts.locationMode === "market";
}
