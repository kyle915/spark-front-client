/**
 * The Staffing Board, read by person: one row per ambassador across the
 * week, with the shifts still needing someone gathered in a row of their own
 * at the top. The by-venue grid answers "is this store covered?"; this one
 * answers "what is each person working, and what is left over?".
 */

export type BoardShiftLike = {
  readonly eventUuid: string;
  readonly brandName: string;
  readonly date?: string | null;
  readonly isStaffed: boolean;
  readonly assigned: ReadonlyArray<{
    readonly ambassadorUuid: string;
    readonly name: string;
    readonly isApproved: boolean;
  }>;
};

export const UNASSIGNED_KEY = "__unassigned__";

export type PersonRow<T> = {
  key: string;
  name: string;
  /** The row of shifts that still need someone. */
  unassigned: boolean;
  /** Shifts this week (a count of cards in the row). */
  total: number;
  /** Booked but not yet approved, per shift, for this person. */
  pending: ReadonlySet<string>;
  byDay: ReadonlyMap<string, T[]>;
};

export type StaffingCounts = {
  unstaffed: number;
  staffed: number;
  people: number;
};

const dayKey = (iso: string | null | undefined): string | null =>
  iso ? String(iso).slice(0, 10) : null;

export function byPersonRows<T extends BoardShiftLike>(
  shifts: ReadonlyArray<T>,
): { rows: PersonRow<T>[]; counts: StaffingCounts } {
  type Draft = {
    key: string;
    name: string;
    unassigned: boolean;
    total: number;
    pending: Set<string>;
    byDay: Map<string, T[]>;
  };
  const drafts = new Map<string, Draft>();
  const rowFor = (key: string, name: string, unassigned: boolean): Draft => {
    let row = drafts.get(key);
    if (!row) {
      row = { key, name, unassigned, total: 0, pending: new Set(), byDay: new Map() };
      drafts.set(key, row);
    }
    return row;
  };
  const place = (row: Draft, shift: T) => {
    const day = dayKey(shift.date);
    if (!day) return;
    const list = row.byDay.get(day) ?? [];
    list.push(shift);
    row.byDay.set(day, list);
    row.total += 1;
  };

  let unstaffed = 0;
  for (const shift of shifts) {
    if (!shift.isStaffed) {
      unstaffed += 1;
      place(rowFor(UNASSIGNED_KEY, "Needs someone", true), shift);
    }
    for (const person of shift.assigned) {
      const row = rowFor(
        person.ambassadorUuid,
        person.name.trim() || "Unnamed ambassador",
        false,
      );
      place(row, shift);
      if (!person.isApproved) row.pending.add(shift.eventUuid);
    }
  }

  const people = [...drafts.values()]
    .filter((r) => !r.unassigned)
    .sort((a, b) => a.name.localeCompare(b.name));
  const open = drafts.get(UNASSIGNED_KEY);
  return {
    rows: open ? [open, ...people] : people,
    counts: { unstaffed, staffed: shifts.length - unstaffed, people: people.length },
  };
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "325 shifts need someone · 57 staffed · 23 people booked" */
export function staffingFooter(counts: StaffingCounts): string {
  return [
    counts.unstaffed > 0
      ? `${plural(counts.unstaffed, "shift needs", "shifts need")} someone`
      : "Every shift is staffed",
    `${counts.staffed.toLocaleString()} staffed`,
    `${plural(counts.people, "person", "people")} booked`,
  ].join(" · ");
}
