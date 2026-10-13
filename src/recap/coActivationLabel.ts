/** "Co-activation with FAMUS Energy" — names only, never the other brand's numbers. */
export function coActivationLabel(brandNames?: readonly string[] | null): string {
  const names = (brandNames ?? []).filter(Boolean);
  return names.length ? `Co-activation with ${names.join(" & ")}` : "";
}
