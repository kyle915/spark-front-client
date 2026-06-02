function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * A recap is only "due" once the event has actually happened — specifically
 * starting the day AFTER the event date. Upcoming and same-day events must NOT
 * be flagged as due (otherwise every future booking lights up the tracker +
 * the sidebar "N RECAPS DUE" badge).
 *
 * `lookbackDays` (default 30) bounds how far back a past event still counts as
 * due. This matches the backend `missing_recap_events` window (events in the
 * last 30 days with no recap) so the sidebar badge doesn't ratchet up forever
 * on ancient un-recapped events. Pass `Infinity` for an unbounded "any past
 * event" check (e.g. a per-row status chip that should reflect all history).
 *
 * Compares date-only strings (YYYY-MM-DD) against the viewer's local day, so a
 * raw ISO datetime or a bare date both work and there's no timezone drift from
 * parsing the value as UTC.
 */
export function isRecapDue(
  eventDate: string | null | undefined,
  lookbackDays = 30,
): boolean {
  const s = String(eventDate ?? "").slice(0, 10);
  if (!s) return false;
  const today = localDateString(new Date());
  // Strictly before today → the day after the event has arrived.
  if (s >= today) return false;
  // Lower bound: on/after (today − lookbackDays), still date-only/local. A
  // non-finite lookback (e.g. Infinity) means no lower bound — any past event.
  if (!Number.isFinite(lookbackDays)) return true;
  const lower = new Date();
  lower.setDate(lower.getDate() - lookbackDays);
  return s >= localDateString(lower);
}
