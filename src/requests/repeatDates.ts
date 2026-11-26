/**
 * Generate N weekly repeat dates (YYYY-MM-DD) after a primary YYYY-MM-DD date,
 * using local calendar arithmetic so DST boundaries never shift a day, and
 * skipping dates already present in `existingExtraDates`.
 */
export function generateWeeklyRepeatDates(
  primaryDate: string,
  existingExtraDates: ReadonlyArray<string>,
  weeks = 3,
): string[] {
  const m = primaryDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || weeks <= 0) return [];
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const seen = new Set<string>([
    primaryDate.trim(),
    ...existingExtraDates.map((d) => d.trim()).filter(Boolean),
  ]);
  // Anchor from the latest valid date already in the list so clicking
  // "+ Repeat weekly ×3" a second time appends the next 3 weeks cleanly.
  const validExisting = existingExtraDates
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const anchorStr =
    validExisting.length > 0 && validExisting[validExisting.length - 1] > primaryDate.trim()
      ? validExisting[validExisting.length - 1]
      : primaryDate.trim();
  const am = anchorStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const baseYear = am ? Number(am[1]) : year;
  const baseMonth = am ? Number(am[2]) - 1 : month;
  const baseDay = am ? Number(am[3]) : day;

  const added: string[] = [];
  for (let w = 1; w <= weeks; w += 1) {
    const next = new Date(baseYear, baseMonth, baseDay + w * 7);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    if (!seen.has(iso)) {
      seen.add(iso);
      added.push(iso);
    }
  }
  return added;
}
