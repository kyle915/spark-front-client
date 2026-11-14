/** A figure shown part-way through counting up: "257K+" at 0.5 → "129K+".
 *  Prefix and suffix stay put; only the number moves. Text with no number
 *  comes back unchanged. */
export const countUpText = (target: string, progress: number): string => {
  const match = /^(\D*)(\d[\d,]*)(.*)$/.exec(target);
  if (!match) return target;
  const [, before, digits, after] = match;
  const goal = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(goal)) return target;
  const p = Math.min(1, Math.max(0, progress));
  // Ease out: quick at first, settling onto the real figure.
  const eased = 1 - (1 - p) ** 3;
  const value = p >= 1 ? goal : Math.round(goal * eased);
  const shown = digits.includes(",") ? value.toLocaleString("en-US") : String(value);
  return `${before}${shown}${after}`;
};
