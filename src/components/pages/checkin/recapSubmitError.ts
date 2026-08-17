/**
 * Error copy the standing check-in recap form shows the BA.
 *
 * The API already speaks in their language ("Add at least one photo of
 * your event.", "No check-in found for that date."). A generic
 * "Couldn't submit" is what made Friday's recap feel like a lock.
 */
export function recapSubmitErrorMessage(
  json: { message?: string; error?: string } | null | undefined,
  status: number,
): string {
  const msg = String(json?.message ?? "").trim();
  if (msg) return msg;
  if (status === 401) {
    return "Your check-in session expired. Start over and pick the date you worked.";
  }
  if (status === 400) {
    return "Couldn't submit your recap. Add the required photos and try again.";
  }
  return "Couldn't submit your recap. Check your signal and try again.";
}
