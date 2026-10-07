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

// Market-mode (roaming) brands street-sample under Retail Sampling, so the
// default "street samplings" line would steer their everyday shift into
// Event Activation.
const ROAMING_DESCRIPTORS: Record<string, string> = {
  "retail sampling":
    "Your regular market shift — sampling spots around town, logged as you go.",
  "event activation":
    "One festival, concert, or community event at a single venue.",
};

/** Return helper text for a known program name, else null. */
export function eventTypeDescription(
  name: string | null | undefined,
  opts: { roaming?: boolean } = {},
): string | null {
  const key = normalizeEventTypeName(name);
  if (!key) return null;
  const table = opts.roaming ? { ...DESCRIPTORS, ...ROAMING_DESCRIPTORS } : DESCRIPTORS;
  if (table[key]) return table[key];
  // "Liquid Death-Retail Sampling" and similar prefixed labels.
  for (const [label, text] of Object.entries(table)) {
    if (key.includes(label)) return text;
  }
  return null;
}

/**
 * A walk-up program as the API sends it. `name` is the real event type (it
 * drives the location step); `label` / `description` are optional per-brand
 * display copy (Torch: "Event", "Guerilla", "Seeding", "Retail").
 */
export type ProgramOption = {
  id: string;
  name: string;
  label?: string;
  description?: string;
};

/** BA-facing title for a program: brand label, else the event type name. */
export function programLabel(t: Pick<ProgramOption, "name" | "label">): string {
  return t.label?.trim() || t.name;
}

/** Brand helper line, else the built-in descriptor for the event type name. */
export function programDescription(
  t: Pick<ProgramOption, "name" | "description">,
  opts: { roaming?: boolean } = {},
): string | null {
  return t.description?.trim() || eventTypeDescription(t.name, opts);
}

/** True when at least one offered program has BA-facing helper copy. */
export function eventTypesUseDescriptorPicker(
  eventTypes: ReadonlyArray<Pick<ProgramOption, "name" | "description">>,
): boolean {
  return eventTypes.some((t) => programDescription(t) !== null);
}

/**
 * Product Seeding asks for drop-off location (+ mileage) on the recap form,
 * so the identify step should not show "Where are you working today".
 * Retail Sampling / Event Activation keep the store/market gate.
 */
/** Event Activation happens at a festival or venue, not a store. */
export function eventTypeIsActivation(name: string | null | undefined): boolean {
  return /\bactivation\b/i.test(name ?? "");
}

export function eventTypeSkipsIdentifyLocation(
  name: string | null | undefined,
): boolean {
  return /product\s*seeding/i.test(name ?? "");
}
