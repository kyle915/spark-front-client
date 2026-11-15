/**
 * Pure helpers for "Find ambassadors" on the Staffing Board: the filter the
 * search runs on, the chips that show how a question was read, and the plain
 * reasons shown beside each person. No Relay types here, so this is testable
 * on its own.
 */

export type SearchFilter = {
  retailer: string;
  city: string;
  state: string;
  brand: string;
  dateFrom: string;
  dateTo: string;
  minShifts: number;
  mustBeFree: boolean;
};

export type FilterKey = "retailer" | "city" | "state" | "brand" | "date" | "minShifts";

export const EMPTY_FILTER: SearchFilter = {
  retailer: "",
  city: "",
  state: "",
  brand: "",
  dateFrom: "",
  dateTo: "",
  minShifts: 1,
  mustBeFree: false,
};

type ServerFilter = {
  readonly retailer?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly brand?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly minShifts?: number | null;
  readonly mustBeFree?: boolean | null;
};

export function filterFromServer(f: ServerFilter | null | undefined): SearchFilter {
  return {
    retailer: f?.retailer ?? "",
    city: f?.city ?? "",
    state: f?.state ?? "",
    brand: f?.brand ?? "",
    dateFrom: f?.dateFrom ?? "",
    dateTo: f?.dateTo ?? "",
    minShifts: f?.minShifts && f.minShifts > 1 ? f.minShifts : 1,
    mustBeFree: Boolean(f?.mustBeFree),
  };
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const blank = (v: string): string | null => (v.trim() ? v.trim() : null);
const day = (v: string): string | null => (ISO_DAY.test(v.trim()) ? v.trim() : null);

/** The variables for the query. Blank boxes go as null, never as "". */
export function toFilterInput(f: SearchFilter) {
  const dateFrom = day(f.dateFrom) ?? day(f.dateTo);
  const dateTo = day(f.dateTo) ?? dateFrom;
  return {
    retailer: blank(f.retailer),
    city: blank(f.city),
    state: blank(f.state),
    brand: blank(f.brand),
    dateFrom,
    dateTo,
    minShifts: f.minShifts > 1 ? Math.floor(f.minShifts) : null,
    mustBeFree: Boolean(f.mustBeFree && dateFrom),
  };
}

export function isEmptyFilter(f: SearchFilter): boolean {
  const input = toFilterInput(f);
  return !(
    input.retailer ||
    input.city ||
    input.state ||
    input.brand ||
    input.dateFrom ||
    input.minShifts
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-21" -> "Sat 21 Nov". Read as a calendar day, never shifted by zone. */
export function dayLabel(iso: string | null | undefined): string {
  const match = ISO_DAY.exec((iso ?? "").trim().slice(0, 10));
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (isNaN(date.getTime())) return "";
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function dayRangeLabel(from: string, to: string): string {
  const a = dayLabel(from);
  const b = dayLabel(to);
  if (!a) return b;
  return b && b !== a ? `${a} to ${b}` : a;
}

export type FilterChip = { key: FilterKey; text: string };

/** How the filter reads, one chip per thing asked for. */
export function filterChips(f: SearchFilter): FilterChip[] {
  const input = toFilterInput(f);
  const chips: FilterChip[] = [];
  if (input.retailer) chips.push({ key: "retailer", text: `Store: ${input.retailer}` });
  if (input.city) chips.push({ key: "city", text: `City: ${input.city}` });
  if (input.state) chips.push({ key: "state", text: `State: ${input.state.toUpperCase()}` });
  if (input.brand) chips.push({ key: "brand", text: `Brand: ${input.brand}` });
  if (input.dateFrom) {
    const days = dayRangeLabel(input.dateFrom, input.dateTo ?? input.dateFrom);
    chips.push({ key: "date", text: `${input.mustBeFree ? "Free on" : "Day"}: ${days}` });
  }
  if (input.minShifts) {
    chips.push({ key: "minShifts", text: `At least ${input.minShifts} shifts` });
  }
  return chips;
}

export function withoutChip(f: SearchFilter, key: FilterKey): SearchFilter {
  switch (key) {
    case "retailer":
      return { ...f, retailer: "" };
    case "city":
      return { ...f, city: "" };
    case "state":
      return { ...f, state: "" };
    case "brand":
      return { ...f, brand: "" };
    case "date":
      return { ...f, dateFrom: "", dateTo: "", mustBeFree: false };
    case "minShifts":
      return { ...f, minShifts: 1 };
  }
}

export type MatchLike = {
  readonly shiftsWorked: number;
  readonly stores: ReadonlyArray<string>;
  readonly cities: ReadonlyArray<string>;
  readonly lastShiftDate?: string | null;
  readonly isFree?: boolean | null;
  readonly availability?: string | null;
  readonly conflicts: ReadonlyArray<{
    readonly eventName: string;
    readonly brandName: string;
    readonly store?: string | null;
    readonly date?: string | null;
    readonly startLocal?: string | null;
    readonly isApproved: boolean;
  }>;
};

const WALL_CLOCK = /T(\d{2}):(\d{2})/;

function clockLabel(local: string | null | undefined): string {
  const match = WALL_CLOCK.exec(local ?? "");
  if (!match) return "";
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

/** Why this person is on the list, as short plain lines. */
export function matchReasons(m: MatchLike): string[] {
  const lines: string[] = [];
  const worked = [`${m.shiftsWorked} ${m.shiftsWorked === 1 ? "shift" : "shifts"}`];
  if (m.stores.length) worked.push(m.stores.join(", "));
  if (m.cities.length) worked.push(m.cities.join(", "));
  lines.push(worked.join(" · "));
  const last = dayLabel(m.lastShiftDate);
  if (last) lines.push(`Last shift ${last}`);
  for (const c of m.conflicts) {
    const what = [c.store || c.eventName, c.brandName].filter(Boolean).join(", ");
    const when = [dayLabel(c.date), clockLabel(c.startLocal)].filter(Boolean).join(" ");
    lines.push(
      `${c.isApproved ? "Booked" : "Invited, not confirmed"}${when ? ` ${when}` : ""}: ${what}`,
    );
  }
  if (m.availability === "available") lines.push("Listed as available that day");
  if (m.availability === "not_listed") lines.push("Has not listed that day as available");
  return lines;
}

/** "Free" / "Booked" beside the name; nothing when no day was asked for. */
export function freeLabel(m: Pick<MatchLike, "isFree">): string {
  if (m.isFree === true) return "Free";
  if (m.isFree === false) return "Booked";
  return "";
}
