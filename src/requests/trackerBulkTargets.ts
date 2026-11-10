export type BulkRow = {
  id: string;
  statusSlug: string;
  eventId: string | null;
};

const APPROVABLE = new Set(["pending", "queue"]);

/** Which of the selected tracker rows each bulk action applies to. */
export function bulkTargets(rows: readonly BulkRow[]) {
  return {
    approvable: rows.filter((r) => APPROVABLE.has(r.statusSlug.toLowerCase())),
    assignable: rows.filter((r) => Boolean(r.eventId)),
  };
}
