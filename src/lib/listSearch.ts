/**
 * Pure helpers for the search on the Recaps list and the Master Tracker:
 * the filter the search runs on, the chips that show how a sentence was
 * read, and the words for a result row. No Relay types here, so this is
 * testable on its own.
 *
 * The filter has the same shape as "Find ambassadors"
 * (`pages/staffing/staffingSearch.ts`) so both share `FilterChips`.
 */

export type ListName = "recaps" | "events";
export type Metric = "consumers" | "units_sold" | "conversion";
export type Op = "lt" | "lte" | "gt" | "gte" | "eq";

export type Condition = { metric: Metric; op: Op; value: number };

export type ListFilter = {
  state: string;
  city: string;
  store: string;
  dateFrom: string;
  dateTo: string;
  /** "" | approved | needs_review | archived. Recaps list, staff only. */
  status: string;
  /** "" | retail | onprem | event | guerilla | seeding */
  activationType: string;
  product: string;
  conditions: Condition[];
};

export const EMPTY_LIST_FILTER: ListFilter = {
  state: "",
  city: "",
  store: "",
  dateFrom: "",
  dateTo: "",
  status: "",
  activationType: "",
  product: "",
  conditions: [],
};

export const METRICS: ReadonlyArray<{ key: Metric; label: string }> = [
  { key: "consumers", label: "Consumers sampled" },
  { key: "units_sold", label: "Units sold" },
  { key: "conversion", label: "Conversion %" },
];

export const OPS: ReadonlyArray<{ key: Op; label: string; words: string }> = [
  { key: "lt", label: "under", words: "under" },
  { key: "lte", label: "at most", words: "at most" },
  { key: "gt", label: "over", words: "over" },
  { key: "gte", label: "at least", words: "at least" },
  { key: "eq", label: "exactly", words: "exactly" },
];

export const ACTIVATION_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "retail", label: "Retail" },
  { key: "onprem", label: "On-Premise" },
  { key: "event", label: "Event" },
  { key: "guerilla", label: "Guerilla" },
  { key: "seeding", label: "Seeding" },
];

export const RECAP_STATUSES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "approved", label: "Approved" },
  { key: "needs_review", label: "Needs review" },
  { key: "archived", label: "Archived" },
];

const METRIC_KEYS = new Set<string>(METRICS.map((m) => m.key));
const OP_KEYS = new Set<string>(OPS.map((o) => o.key));

type ServerFilter = {
  readonly state?: string | null;
  readonly city?: string | null;
  readonly store?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly status?: string | null;
  readonly activationType?: string | null;
  readonly product?: string | null;
  readonly conditions?: ReadonlyArray<{
    readonly metric: string;
    readonly op: string;
    readonly value: number;
  }> | null;
};

export function filterFromServer(f: ServerFilter | null | undefined): ListFilter {
  return {
    state: f?.state ?? "",
    city: f?.city ?? "",
    store: f?.store ?? "",
    dateFrom: f?.dateFrom ?? "",
    dateTo: f?.dateTo ?? "",
    status: f?.status ?? "",
    activationType: f?.activationType ?? "",
    product: f?.product ?? "",
    conditions: (f?.conditions ?? []).flatMap((c) =>
      METRIC_KEYS.has(c.metric) && OP_KEYS.has(c.op) && Number.isFinite(c.value)
        ? [{ metric: c.metric as Metric, op: c.op as Op, value: c.value }]
        : [],
    ),
  };
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const blank = (v: string): string | null => (v.trim() ? v.trim() : null);
const day = (v: string): string | null => (ISO_DAY.test(v.trim()) ? v.trim() : null);

/** The variables for the query. Blank boxes go as null, never as "". */
export function toFilterInput(f: ListFilter) {
  return {
    state: blank(f.state)?.toUpperCase() ?? null,
    city: blank(f.city),
    store: blank(f.store),
    dateFrom: day(f.dateFrom),
    dateTo: day(f.dateTo),
    status: blank(f.status),
    activationType: blank(f.activationType),
    product: blank(f.product),
    conditions: f.conditions
      .filter((c) => Number.isFinite(c.value) && c.value >= 0)
      .map((c) => ({ metric: c.metric, op: c.op, value: c.value })),
  };
}

/** Nothing to search on. A status alone is not a search. */
export function isEmptyFilter(f: ListFilter): boolean {
  const input = toFilterInput(f);
  return !(
    input.state ||
    input.city ||
    input.store ||
    input.dateFrom ||
    input.dateTo ||
    input.activationType ||
    input.product ||
    input.conditions.length
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" -> "Oct 5, 2026". Read as a calendar day, never shifted by zone. */
export function dayLabel(iso: string | null | undefined): string {
  const match = ISO_DAY.exec((iso ?? "").trim().slice(0, 10));
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function dateRangeLabel(from: string | null, to: string | null): string {
  const a = dayLabel(from);
  const b = dayLabel(to);
  if (a && b) return a === b ? a : `${a} to ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Through ${b}`;
  return "";
}

const label = (rows: ReadonlyArray<{ key: string; label: string }>, key: string): string =>
  rows.find((r) => r.key === key)?.label ?? key;

export function conditionText(c: Condition): string {
  const words = OPS.find((o) => o.key === c.op)?.words ?? c.op;
  const amount = c.value.toLocaleString("en-US");
  if (c.metric === "conversion") return `Conversion ${words} ${amount}%`;
  return `${label(METRICS, c.metric)} ${words} ${amount}`;
}

/** "state" … "product", or "cond:0" for the first numeric condition. */
export type ChipKey = string;
export type Chip = { key: ChipKey; text: string };

/** How the filter reads, one chip per thing asked for. */
export function filterChips(f: ListFilter, list: ListName, isClient: boolean): Chip[] {
  const input = toFilterInput(f);
  const chips: Chip[] = [];
  if (input.store) chips.push({ key: "store", text: `Store: ${input.store}` });
  if (input.city) chips.push({ key: "city", text: `City: ${input.city}` });
  if (input.state) chips.push({ key: "state", text: `State: ${input.state}` });
  const dates = dateRangeLabel(input.dateFrom, input.dateTo);
  if (dates) chips.push({ key: "date", text: `Event date: ${dates}` });
  if (input.activationType) {
    chips.push({
      key: "activationType",
      text: `Type: ${label(ACTIVATION_TYPES, input.activationType)}`,
    });
  }
  if (input.product) chips.push({ key: "product", text: `Product: ${input.product}` });
  // A brand user is always on approved recaps: not theirs to change.
  if (input.status && list === "recaps" && !isClient) {
    chips.push({ key: "status", text: `Status: ${label(RECAP_STATUSES, input.status)}` });
  }
  input.conditions.forEach((c, i) => {
    chips.push({ key: `cond:${i}`, text: conditionText(c as Condition) });
  });
  return chips;
}

export function withoutChip(f: ListFilter, key: ChipKey): ListFilter {
  if (key.startsWith("cond:")) {
    const index = Number(key.slice(5));
    return { ...f, conditions: f.conditions.filter((_, i) => i !== index) };
  }
  switch (key) {
    case "store":
      return { ...f, store: "" };
    case "city":
      return { ...f, city: "" };
    case "state":
      return { ...f, state: "" };
    case "date":
      return { ...f, dateFrom: "", dateTo: "" };
    case "activationType":
      return { ...f, activationType: "" };
    case "product":
      return { ...f, product: "" };
    case "status":
      return { ...f, status: "" };
    default:
      return f;
  }
}

export type RowLike = {
  readonly kind: string;
  readonly uuid: string;
  readonly store: string;
  readonly city: string;
  readonly state: string;
  readonly date?: string | null;
  readonly activationType: string;
  readonly status: string;
  readonly requestUuid?: string | null;
  readonly recapCount?: number | null;
  readonly consumers?: number | null;
  readonly unitsSold?: number | null;
  readonly conversion?: number | null;
};

/** Where a result row opens. */
export function rowHref(row: Pick<RowLike, "kind" | "uuid" | "requestUuid">): string {
  if (row.kind === "custom") return `/recap/view-custom/${row.uuid}`;
  if (row.kind === "legacy") return `/recap/view/${row.uuid}`;
  return row.requestUuid ? `/request/view/${row.requestUuid}` : `/event/view/${row.uuid}`;
}

/** "Oct 5, 2026 · Kroger · Houston, TX · Retail". */
export function rowPlaceLine(row: RowLike): string {
  const market = [row.city, row.state].filter(Boolean).join(", ");
  return [
    dayLabel(row.date),
    row.store,
    market,
    row.activationType ? label(ACTIVATION_TYPES, row.activationType) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The row's figures, only the ones it has. Empty when it has none. */
export function rowFigures(row: RowLike): string {
  const parts: string[] = [];
  if (row.consumers != null) parts.push(`${row.consumers.toLocaleString("en-US")} sampled`);
  if (row.unitsSold != null) parts.push(`${row.unitsSold.toLocaleString("en-US")} sold`);
  if (row.conversion != null) parts.push(`${row.conversion}% conversion`);
  if (row.kind === "event" && row.recapCount != null && parts.length === 0) {
    parts.push(row.recapCount === 0 ? "No approved recap" : "");
  }
  return parts.filter(Boolean).join(" · ");
}

export function rowStatusLabel(row: Pick<RowLike, "kind" | "status">, isClient: boolean): string {
  if (row.kind === "event" || isClient) return "";
  return row.status === "approved" ? "" : label(RECAP_STATUSES, row.status);
}

/** "3 recaps", "1 event", "120 recaps, showing the first 100". */
export function resultCountLine(list: ListName, total: number, shown: number): string {
  const noun = list === "recaps" ? "recap" : "event";
  if (total === 0) return `No ${noun}s match. Remove a filter to widen the search.`;
  const count = `${total.toLocaleString("en-US")} ${noun}${total === 1 ? "" : "s"}`;
  return total > shown ? `${count}, showing the first ${shown}` : count;
}

/**
 * The same search in the full Recaps list, when the list can filter on
 * everything asked for (it cannot filter on city, product or a figure).
 * Null when it cannot.
 */
export function fullListHref(f: ListFilter): string | null {
  const input = toFilterInput(f);
  if (input.city || input.product || input.conditions.length) return null;
  if (!(input.store || input.state || input.dateFrom || input.dateTo || input.activationType)) {
    return null;
  }
  const params = new URLSearchParams();
  params.set("status", input.status || "approved");
  if (input.store) params.set("retailer", input.store);
  if (input.state) params.set("state", input.state);
  if (input.activationType) params.set("activation", input.activationType);
  // The list reads either both dates or neither.
  if (input.dateFrom || input.dateTo) {
    params.set("from", input.dateFrom ?? "");
    params.set("to", input.dateTo ?? "");
  } else {
    params.set("range", "all");
  }
  return `/recaps/list?${params.toString()}`;
}
