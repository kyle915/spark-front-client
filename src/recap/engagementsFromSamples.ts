/**
 * Spark's native `totalEngagements` column is the same number Torch (and
 * most retail templates) already ask as "Total number of consumers sampled".
 * File recap used to show both, so BAs typed the same count twice.
 *
 * These matchers are the TS twin of `recaps.types._CONSUMERS_SAMPLED_RE` /
 * `_SAMPLED_DESC_EXCLUDE_RE`: a field whose name is the samples-given count
 * is the source of truth; a demographics field that merely mentions
 * "consumers sampled" is not.
 */

const CONSUMERS_SAMPLED_RE =
  /consumers?\s+sampled|consumers?\s+did\s+you\s+sample|consumers?\s+did\s+you\s+interact/i;
const SAMPLED_DESC_EXCLUDE_RE = /demographic|age\s*range|ethnicit|gender/i;

export function isConsumersSampledCountField(name: string): boolean {
  if (!CONSUMERS_SAMPLED_RE.test(name)) return false;
  if (SAMPLED_DESC_EXCLUDE_RE.test(name)) return false;
  return true;
}

export function parseCleanCount(value: unknown): number | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw).trim();
  if (!/^\d[\d,\s]*$/.test(s)) return null;
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function templateHasConsumersSampledField(
  fields: { name?: string | null }[],
): boolean {
  return fields.some((f) => isConsumersSampledCountField(f.name ?? ""));
}

export function engagementsFromSamplesGiven(
  fields: { id: string; name?: string | null }[],
  values: Record<string, string | string[] | undefined>,
): number | null {
  for (const f of fields) {
    if (!isConsumersSampledCountField(f.name ?? "")) continue;
    const parsed = parseCleanCount(values[f.id]);
    if (parsed != null) return parsed;
  }
  return null;
}
