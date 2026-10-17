/** Pure helpers for the tenant launch wizard — kept separate for tests. */

export type WizardStep = "basics" | "template" | "catalog" | "walkup" | "review";

export const WIZARD_STEPS: WizardStep[] = [
  "basics",
  "template",
  "catalog",
  "walkup",
  "review",
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyBrand(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateSlug(slug: string): string | null {
  const value = slug.trim().toLowerCase();
  if (!value) return "Slug is required.";
  if (value.length > 50) return "Slug must be 50 characters or fewer.";
  if (!SLUG_PATTERN.test(value)) {
    return "Use lowercase letters, numbers, and single hyphens (e.g. drink-lyft).";
  }
  return null;
}

export function parseLabelSwaps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function validateLabelSwaps(text: string): string | null {
  for (const line of parseLabelSwaps(text)) {
    const idx = line.indexOf("=");
    if (idx <= 0) return `Label swap needs OLD=NEW: "${line}"`;
  }
  return null;
}

/** Count data rows in a catalog CSV (header + non-empty lines). */
export function countCatalogCsv(text: string): number {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return 0;
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("name") || header.includes("title");
  return hasHeader ? lines.length - 1 : lines.length;
}

export function deriveCodePrefix(slug: string, name: string): string {
  const words = (slug || name).split(/[^a-z0-9]+/i).filter(Boolean);
  if (words.length === 0) return "SP";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function stepLabel(step: WizardStep): string {
  switch (step) {
    case "basics":
      return "Brand basics";
    case "template":
      return "Recap template";
    case "catalog":
      return "Product catalog";
    case "walkup":
      return "Walk-up code";
    case "review":
      return "Preview & launch";
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unknown wizard step: ${_exhaustive}`);
    }
  }
}
