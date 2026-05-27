/**
 * A recap is only "due" once the event has actually happened — specifically
 * starting the day AFTER the event date. Upcoming and same-day events must NOT
 * be flagged as due (otherwise every future booking lights up the tracker +
 * the sidebar "N RECAPS DUE" badge).
 *
 * Compares date-only strings (YYYY-MM-DD) against the viewer's local day, so a
 * raw ISO datetime or a bare date both work and there's no timezone drift from
 * parsing the value as UTC.
 */
export function isRecapDue(eventDate: string | null | undefined): boolean {
  const s = String(eventDate ?? "").slice(0, 10);
  if (!s) return false;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  // Strictly before today → the day after the event has arrived.
  return s < today;
}
