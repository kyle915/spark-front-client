export type ChipInputMode = "email" | "state" | "text";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STATE_CODE_RE = /^[A-Za-z]{2}$/;

export function normalizeChipToken(token: string, mode: ChipInputMode): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (mode === "email") return trimmed.toLowerCase();
  if (mode === "state") return trimmed.toUpperCase();
  return trimmed;
}

export function validateChipToken(
  token: string,
  mode: ChipInputMode,
): string | null {
  const clean = normalizeChipToken(token, mode);
  if (!clean) return null;
  if (mode === "email" && !SIMPLE_EMAIL_RE.test(clean)) {
    return `"${token.trim()}" doesn't look like a valid email`;
  }
  if (mode === "state" && !STATE_CODE_RE.test(clean)) {
    return `"${token.trim()}" must be a 2-letter state code (e.g. TX)`;
  }
  return null;
}

export function splitCsvTokens(
  raw: string,
  mode: ChipInputMode = "text",
): string[] {
  if (!raw) return [];
  const parts =
    mode === "email" ? raw.split(/[,;\n\s]+/) : raw.split(/[,;\n]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const norm = normalizeChipToken(part, mode);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

export function joinCsvTokens(tokens: readonly string[]): string {
  return tokens.filter(Boolean).join(", ");
}
