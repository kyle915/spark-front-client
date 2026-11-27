export type UpcomingHorizonDays = 7 | 14 | 30;

export const UPCOMING_HORIZONS: ReadonlyArray<{
  days: UpcomingHorizonDays;
  label: string;
}> = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

export type UpcomingAttentionFilter = "all" | "attention";

export function rowNeedsAttention(row: {
  statusSlug: string;
  hasAddress?: boolean;
}): boolean {
  return (
    row.statusSlug === "pending" ||
    row.statusSlug === "queue" ||
    row.hasAddress === false
  );
}

export function filterUpcomingRows<
  T extends {
    name: string;
    location: string;
    statusSlug: string;
    hasAddress?: boolean;
  },
>(
  rows: readonly T[],
  attention: UpcomingAttentionFilter,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (attention === "attention" && !rowNeedsAttention(row)) {
      return false;
    }
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.location.toLowerCase().includes(q)
    );
  });
}
