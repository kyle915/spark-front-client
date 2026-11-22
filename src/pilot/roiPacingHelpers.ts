/** Pure helpers for budget pacing UI — kept free of Relay so Vitest can
 * exercise them without `__generated__` artifacts. */

export type PaceStatus =
  | "on_track"
  | "under_booked"
  | "over_booked"
  | "no_target"
  | string;

export function formatPaceMoney(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatPaceRate(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return n.toFixed(2);
}

export function paceStatusLabel(status: PaceStatus): string {
  switch (status) {
    case "under_booked":
      return "Under-booked";
    case "over_booked":
      return "Over-booked";
    case "on_track":
      return "On track";
    case "no_target":
      return "No target set";
    default:
      return status;
  }
}

export function spendBarPct(projected: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(projected)) return 0;
  return Math.min(Math.max(projected / target, 0), 1.25);
}

export function flattenAttentionRows(
  buckets: Array<{
    key: string;
    label: string;
    items: Array<{
      bucket: string;
      title: string;
      refId: string;
      actionUrl: string;
    }>;
  }>,
): Array<{ key: string; title: string; actionUrl: string; bucketLabel: string }> {
  return buckets.flatMap((b) =>
    (b.items ?? []).map((item) => ({
      key: `${item.bucket}-${item.refId}`,
      title: item.title,
      actionUrl: item.actionUrl,
      bucketLabel: b.label || item.bucket,
    })),
  );
}
