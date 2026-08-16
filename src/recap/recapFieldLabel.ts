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
