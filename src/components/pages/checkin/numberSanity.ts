/**
 * Gentle, non-blocking checks on numbers an ambassador types into a recap.
 *
 * The bad numbers that reach client reports mostly start here: a price typed
 * as "1279" because the phone keypad had no decimal point, sales typed as
 * "125342.00", a percentage over 100. Each check returns a short hint shown
 * under the field; nothing is rejected — the ambassador may be right.
 */

const PRICE_RE = /\bprice\b|\bcost per\b|\bmsrp\b|\bsrp\b/i;
const MONEY_RE =
  /\$|\bsales\b|\brevenue\b|\bspend\b|\bspent\b|\bamount\b|\bexpense|\btotal cost\b/i;
const PERCENT_RE = /%|\bpercent|\bconversion rate\b|\brate\b/i;
const COUNT_RE =
  /sampled|sold|consumers?|engag|\bunits?\b|how many|inventory|samples|purchas|\bcans?\b|\bpacks?\b|\bcases?\b/i;
const NOT_A_COUNT_RE = /zip|postal|phone|store\s*(#|no\b|number)|\bid\b|\bcode\b|\byear\b/i;

/** A whole shift rarely reaches these; above them, ask once. */
export const COUNT_ASK_ABOVE = 5000;
export const MONEY_ASK_ABOVE = 20000;
export const PRICE_ASK_ABOVE = 100;

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parse = (raw: string): number | null => {
  const cleaned = raw.replace(/[$,\s%]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** True when a field should get the keypad WITH a decimal point. iOS's
 *  plain numeric keypad has none, which is how "12.79" becomes "1279". */
export const wantsDecimalKeypad = (label: string): boolean =>
  PRICE_RE.test(label) || MONEY_RE.test(label) || PERCENT_RE.test(label);

export function numberHint(
  label: string,
  rawValue: unknown,
  opts: { isNumberField?: boolean } = {},
): string | null {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) return null;
  const n = parse(raw);
  if (n === null) {
    return opts.isNumberField && /[a-z]/i.test(raw)
      ? "Numbers only here — put notes in a comment field."
      : null;
  }
  if (n < 0) return "This can't be negative.";
  if (NOT_A_COUNT_RE.test(label)) return null;

  const hasDecimal = raw.includes(".");
  if (PRICE_RE.test(label)) {
    if (!hasDecimal && n >= PRICE_ASK_ABOVE) {
      return `That reads as ${money(n)}. If you meant ${money(n / 100)}, add the decimal point.`;
    }
    return null;
  }
  if (PERCENT_RE.test(label) && !MONEY_RE.test(label)) {
    return n > 100 ? "A percentage can't be more than 100." : null;
  }
  if (MONEY_RE.test(label)) {
    if (n >= MONEY_ASK_ABOVE) {
      return `That reads as ${money(n)}. If you meant ${money(n / 100)}, fix the decimal point.`;
    }
    return null;
  }
  if (COUNT_RE.test(label)) {
    if (hasDecimal && !Number.isInteger(n)) return "This should be a whole number.";
    if (n > COUNT_ASK_ABOVE) {
      return `${n.toLocaleString("en-US")} is a lot for one shift — double-check before you submit.`;
    }
  }
  return null;
}
