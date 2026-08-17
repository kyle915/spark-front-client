/** Public /spark-form slug for Torch THC. */
export const TORCH_REQUEST_FORM_SLUG = "keee-torch-thc";

/** Torch's public request form (and the matching internal tenant). */
export function isTorchRequestForm(slug: string | null | undefined): boolean {
  return (slug ?? "").trim() === TORCH_REQUEST_FORM_SLUG;
}
