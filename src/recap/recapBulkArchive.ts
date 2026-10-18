/**
 * Bulk-archive partitioning for the recaps list selection bar.
 *
 * Archive is orthogonal to approval: it stamps `archived_at` only, never
 * flips `approved`, and sends no client email (the single-recap
 * archiveRecap / archiveCustomRecap mutations used on detail pages).
 * Already-archived rows are skipped so re-archiving is a no-op.
 */
export type BulkArchivePartition = {
  /** Relay ids for legacy `archiveRecap`. */
  recapIds: string[];
  /** Relay ids for custom `archiveCustomRecap`. */
  customRecapIds: string[];
  /** Selected rows skipped because they are already archived. */
  skippedArchived: number;
};

export function partitionRecapsForBulkArchive<
  T extends { id: string; kind: "legacy" | "custom"; archivedAt?: string | null },
>(recaps: readonly T[], selectedIds: ReadonlySet<string>): BulkArchivePartition {
  const recapIds: string[] = [];
  const customRecapIds: string[] = [];
  let skippedArchived = 0;
  for (const r of recaps) {
    if (!selectedIds.has(r.id)) continue;
    if (r.archivedAt) {
      skippedArchived += 1;
      continue;
    }
    if (r.kind === "custom") customRecapIds.push(r.id);
    else recapIds.push(r.id);
  }
  return { recapIds, customRecapIds, skippedArchived };
}
