/**
 * What a recap's status pill says on the list.
 *
 * Staff see where the recap really is — archived, shared with the client,
 * approved, or still waiting for review. Brand users only ever see approved
 * recaps, and "Shared" / "Archived" are Ignite's own bookkeeping, so for
 * them an approved recap is simply "Approved".
 */
export type RecapRowTone = "attention" | "done" | "neutral";

export function recapRowStatus(input: {
  emptyShell: boolean;
  approved: boolean;
  sharedAt: string | null | undefined;
  archivedAt: string | null | undefined;
  isClient: boolean;
}): { text: string; tone: RecapRowTone } {
  if (input.emptyShell) return { text: "Not filed", tone: "neutral" };
  if (!input.isClient && input.archivedAt) {
    return { text: "Archived", tone: "neutral" };
  }
  if (!input.approved) return { text: "Needs review", tone: "attention" };
  if (!input.isClient && input.sharedAt) return { text: "Shared", tone: "done" };
  return { text: "Approved", tone: "done" };
}
