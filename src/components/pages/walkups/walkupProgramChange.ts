/**
 * "Program changed by BA from X to Y at 2:14 PM" on a Walk-ups card.
 *
 * The BA can switch their own walk-in shift's program from the check-in page
 * ("Wrong program? Change it"). Staff see the latest switch here so a recap
 * on a different form than the one first picked isn't a surprise.
 */
export type ProgramChangeFields = {
  programChangedFrom?: string | null;
  programChangedTo?: string | null;
  programChangedAt?: string | null;
};

export function programChangeNote(
  row: ProgramChangeFields,
  formatTime: (iso: string) => string = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
): string | null {
  const to = (row.programChangedTo ?? "").trim();
  if (!to) return null;
  const from = (row.programChangedFrom ?? "").trim();
  const at = row.programChangedAt ? formatTime(row.programChangedAt) : "";
  return [
    "Program changed by BA",
    from ? `from ${from}` : "",
    `to ${to}`,
    at ? `at ${at}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
