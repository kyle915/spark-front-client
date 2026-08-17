/**
 * Display-only recap field labels.
 *
 * Template names are often stored in ALL CAPS (Connecteam / LD) and
 * sometimes include the "tasing" typo. Recap views sentence-case long
 * shouting labels and correct that typo without rewriting stored data.
 */

const TASING = /\btasing\b/gi;

function isShouting(raw: string): boolean {
  const letters = raw.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.85;
}

function sentenceCase(raw: string): string {
  const lower = raw.toLowerCase();
  return lower.replace(/(^|[.?!]\s+)([a-z])/g, (_, lead: string, ch: string) => {
    return `${lead}${ch.toUpperCase()}`;
  });
}

export function formatRecapFieldLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  const fixed = raw.trim().replace(TASING, "tasting");
  return isShouting(fixed) ? sentenceCase(fixed) : fixed;
}

function titleCaseWords(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

/**
 * Product / SKU names are often stored as shouting catalog strings
 * ("SPARKLING WATER - STRAWBERRY TERROR"). Display as readable
 * identity: "Sparkling water · Strawberry Terror".
 */
export function formatRecapProductName(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  const parts = s.split(/\s+[-–—]\s+/);
  if (parts.length === 1) {
    return isShouting(s) ? titleCaseWords(s) : s;
  }
  const [kind, ...flavors] = parts;
  const head = isShouting(kind) ? sentenceCase(kind) : kind;
  const tail = flavors.map((part) =>
    isShouting(part) ? titleCaseWords(part) : part,
  );
  return [head, ...tail].join(" · ");
}

export function recapLabelsMatch(a: string, b: string): boolean {
  return (
    formatRecapFieldLabel(a).toLowerCase() ===
    formatRecapFieldLabel(b).toLowerCase()
  );
}
