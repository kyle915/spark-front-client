/**
 * Pure calendar-month helpers for the Monthly Executive Snapshot picker.
 * Kept Relay-free so unit tests run cleanly before Relay artifact generation.
 */

export interface SnapshotMonthOption {
  year: number;
  month: number;
  key: string;
  label: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Returns the last `count` complete calendar months (newest first), starting
 * with the prior complete calendar month relative to `refDate`.
 *
 * Example: on 2026-11-27 with `count = 6`, returns:
 * October 2026, September 2026, August 2026, July 2026, June 2026, May 2026.
 */
export function recentSnapshotMonths(
  count = 6,
  refDate: Date = new Date(),
): SnapshotMonthOption[] {
  const safeCount = Math.max(1, Math.min(24, Math.floor(count)));
  const out: SnapshotMonthOption[] = [];
  let year = refDate.getFullYear();
  let month = refDate.getMonth(); // 0-indexed current month = 1-indexed prior month

  for (let i = 0; i < safeCount; i += 1) {
    if (month <= 0) {
      year -= 1;
      month = 12;
    }
    const mm = String(month).padStart(2, "0");
    out.push({
      year,
      month,
      key: `${year}-${mm}`,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    });
    month -= 1;
  }

  return out;
}

export function parseSnapshotMonthKey(
  key: string,
): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}
