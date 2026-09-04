/**
 * Short BA-facing copy for standing-link program pickers.
 *
 * Liquid Death (and any brand with the same event-type names) offers Retail
 * Sampling vs Event Activation vs Product Seeding on one check-in link. The
 * names alone are easy to mis-pick — retail demos filed as activations miss
 * fields like Account Spendings. These lines sit under each option on the
 * walk-up identify step.
 */

export function normalizeEventTypeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const DESCRIPTORS: Record<string, string> = {
  "retail sampling":
    "All sampling demos done at gas stations, grocery stores or retail chains.",
  "on-premise":
    "Bar or venue sampling — back bar, drink features, and consumer cans.",
  "event activation":
    "All music festivals, street samplings, or similar events.",
  "product seeding":
    "Dropping off cases at a venue or retailer — not a sampling shift.",
};

/** Return helper text for a known program name, else null. */
export function eventTypeDescription(
  name: string | null | undefined,
): string | null {
  const key = normalizeEventTypeName(name);
  if (!key) return null;
  if (DESCRIPTORS[key]) return DESCRIPTORS[key];
  // "Liquid Death-Retail Sampling" and similar prefixed labels.
  for (const [label, text] of Object.entries(DESCRIPTORS)) {
    if (key.includes(label)) return text;
  }
  return null;
}

/** True when at least one offered program has BA-facing helper copy. */
export function eventTypesUseDescriptorPicker(
  eventTypes: ReadonlyArray<{ name: string }>,
): boolean {
  return eventTypes.some((t) => eventTypeDescription(t.name) !== null);
}

/**
 * Product Seeding asks for drop-off location (+ mileage) on the recap form,
 * so the identify step should not show "Where are you working today".
 * Retail Sampling / Event Activation keep the store/market gate.
 */
export function eventTypeSkipsIdentifyLocation(
  name: string | null | undefined,
): boolean {
  return /product\s*seeding/i.test(name ?? "");
}
