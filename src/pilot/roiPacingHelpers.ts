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

/** Value for the monthly target input after a month/server refetch.
 * Always adopts the server target for the selected month (empty when unset)
 * so a prior month's draft cannot be saved into a newly selected month. */
export function syncedTargetEditorAmount(args: {
  selectedMonth: string;
  serverMonth: string | null | undefined;
  serverTarget: string | null | undefined;
}): string {
  const selected = (args.selectedMonth || "").slice(0, 7);
  const server = (args.serverMonth || "").slice(0, 7);
  if (server && selected && server !== selected) {
    // Query still resolving the previous month — keep blank until match.
    return "";
  }
  return args.serverTarget ?? "";
}

/** Missing-recap chase is Ignite ops (/recaps/missing). Brand/client
 * dashboards keep receipt checks, unstaffed, and rebooks only. */
export function attentionBucketsForViewer<
  T extends { key: string; count: number; items: ReadonlyArray<unknown> },
>(
  buckets: ReadonlyArray<T> | null | undefined,
  opts: { staff: boolean },
): { buckets: T[]; totalCount: number } {
  const source = [...(buckets ?? [])];
  const next = opts.staff
    ? source
    : source.map((b) =>
        b.key === "missing_recaps"
          ? ({ ...b, count: 0, items: [] } as T)
          : b,
      );
  return {
    buckets: next,
    totalCount: next.reduce((sum, b) => sum + (b.count || 0), 0),
  };
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
  opts: { staff?: boolean } = {},
): Array<{ key: string; title: string; actionUrl: string; bucketLabel: string }> {
  const staff = opts.staff !== false;
  const { buckets: visible } = attentionBucketsForViewer(buckets, { staff });
  return visible.flatMap((b) =>
    (b.items ?? []).map((item) => ({
      key: `${item.bucket}-${item.refId}`,
      title: item.title,
      actionUrl: item.actionUrl,
      bucketLabel: b.label || item.bucket,
    })),
  );
}
