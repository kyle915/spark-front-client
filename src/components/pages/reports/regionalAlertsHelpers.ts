/** Pure helpers for Regional Manager Alert Subscriptions. */

export function parseCsvTokens(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
