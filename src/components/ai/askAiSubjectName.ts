/**
 * Display name for the Ask AI modal title.
 *
 * The sidebar tenant switcher shows Tenant.name ("Brand Revolution").
 * The spark-form slug is a different field (`jgwf-brand-revolution`) and
 * must not be title-cased into the title — that prefix is what showed up
 * as "Jgwf" in front of the brand.
 *
 * Cleaning only drops leading junk (zero-width chars, private-use icon
 * glyphs, decoded HTML entities, bullets). Letters, digits, and
 * punctuation stay, so "Brew Dr.", "O.G.", and "7-Eleven" are unchanged.
 */

const LEADING_JUNK =
  /^[\s\p{C}\p{So}\p{Sk}\p{Sm}\p{Pd}\u00B7\u2022\u2023\u2043\u2219\u25AA\u25A0\u25CF\uFEFF]+/u;

const ENTITY_RUN =
  /^(?:&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);)+/;

const ENTITY =
  /&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  shy: "",
  zwj: "",
  zwnj: "",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntity(entity: string): string {
  const body = entity.slice(1, -1);
  if (body.startsWith("#")) {
    const hex = body[1] === "x" || body[1] === "X";
    const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      return "";
    }
    return String.fromCodePoint(codePoint);
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? "";
}

function decodeLeadingEntities(value: string): string {
  return value.replace(ENTITY_RUN, (run) => run.replace(ENTITY, decodeEntity));
}

function stripLeadingJunk(value: string): string {
  return value.replace(LEADING_JUNK, "").trim();
}

/** Tenant switcher name, with leading icon/entity junk removed. */
export function askAiSubjectName(raw: string | null | undefined): string {
  if (!raw) return "";
  const decoded = decodeLeadingEntities(raw.trim());
  const stripped = stripLeadingJunk(decoded);
  return stripLeadingJunk(decodeLeadingEntities(stripped));
}

/**
 * Prefer the tenant display name. Never fall back to requestUrlName —
 * that slug is an internal spark-form id, not the label operators see.
 */
export function askAiSubjectFromTenant(input: {
  name?: string | null;
  requestUrlName?: string | null;
}): string {
  return askAiSubjectName(input.name);
}

export function askAiModalTitle(tenantName: string | null | undefined): string {
  const name = askAiSubjectName(tenantName);
  if (!name) return "Ask about this client.";
  // "Brew Dr." and "O.G." already end with a period.
  return /[.!?]$/.test(name) ? `Ask about ${name}` : `Ask about ${name}.`;
}
