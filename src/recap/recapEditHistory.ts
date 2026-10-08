/**
 * Staff metric corrections on a recap (RecapMetricEdit rows, newest first),
 * grouped into one entry per Save for the admin history sheet.
 */

export type RecapMetricEdit = {
  readonly id: string;
  readonly batch: string;
  readonly fieldKey: string;
  readonly fieldLabel: string;
  readonly oldValue: string | null | undefined;
  readonly newValue: string | null | undefined;
  readonly reason: string;
  readonly editedByName: string | null | undefined;
  readonly editedAt: string;
};

export type RecapEditBatch = {
  batch: string;
  editedByName: string;
  editedAt: string;
  reason: string;
  changes: RecapMetricEdit[];
};

export function groupRecapEdits(
  edits: ReadonlyArray<RecapMetricEdit> | null | undefined,
): RecapEditBatch[] {
  const batches = new Map<string, RecapEditBatch>();
  for (const edit of edits ?? []) {
    const existing = batches.get(edit.batch);
    if (existing) {
      existing.changes.push(edit);
      continue;
    }
    batches.set(edit.batch, {
      batch: edit.batch,
      editedByName: edit.editedByName || "Ignite staff",
      editedAt: edit.editedAt,
      reason: edit.reason,
      changes: [edit],
    });
  }
  return [...batches.values()];
}

/**
 * The BA's submitted value per field: the oldest edit's old value. Lets the
 * sheet show "Originally submitted" next to the current number.
 */
export function originalValues(
  edits: ReadonlyArray<RecapMetricEdit> | null | undefined,
): Map<string, string | null> {
  const originals = new Map<string, string | null>();
  for (const edit of [...(edits ?? [])].reverse()) {
    if (!originals.has(edit.fieldKey)) {
      originals.set(edit.fieldKey, edit.oldValue ?? null);
    }
  }
  return originals;
}

export function formatEditedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function editedNote(
  edits: ReadonlyArray<RecapMetricEdit> | null | undefined,
): string | null {
  const latest = edits?.[0];
  if (!latest) return null;
  const date = new Date(latest.editedAt);
  const day = Number.isNaN(date.getTime())
    ? latest.editedAt
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  return `Edited by ${latest.editedByName || "Ignite staff"} on ${day}`;
}
