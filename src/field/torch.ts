/** Torch is the only brand with the field marketing program. */
const TORCH = new Set(["torch", "torch-thc", "keee-torch-thc"]);

export function isTorchTenant(
  slug: string | null | undefined,
  requestUrlName?: string | null,
): boolean {
  return [slug, requestUrlName].some((value) =>
    TORCH.has((value || "").trim().toLowerCase()),
  );
}
