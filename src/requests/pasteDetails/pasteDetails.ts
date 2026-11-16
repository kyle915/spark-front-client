/**
 * Paste details: pure helpers for turning a draft read from a pasted email
 * or sheet row into Create Request form values. No Relay imports, so this
 * file is unit-tested on its own.
 *
 * The server reads the text and leaves blank whatever the text did not say.
 * Nothing here fills a blank: a missing date or time stays empty in the form
 * so the person checking it has to choose one.
 */

export type PastedProduct = { uuid: string; name: string };

export type PastedDraft = {
  /** "YYYY-MM-DD", or "" when no date could be read. */
  date: string;
  dateAsTyped: string;
  /** No year was written; the next time that day comes round was used. */
  yearAssumed: boolean;
  /** Set when a written weekday does not match the date. */
  dateWarning: string;
  /** "HH:MM" on the 24-hour clock, or "". */
  startTime: string;
  startAsTyped: string;
  endTime: string;
  endAsTyped: string;
  /** AM / PM was not written and was settled by the other time. */
  timeAssumed: boolean;
  storeName: string;
  /** The name Spark already uses for this store, "" for a new name. */
  matchedStoreName: string;
  storeNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  /** The address parts on one line. */
  address: string;
  notes: string;
  products: PastedProduct[];
  unmatchedProducts: string[];
  couldNotRead: string[];
};

export type CatalogProduct = { id: string; uuid: string; name: string };

export type DraftFormValues = {
  venue: string;
  address: string;
  storeNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  productIds: string[];
  /** Matched products that are not among the ones this form lists. */
  productsToAddByHand: string[];
};

/**
 * The form values for one draft.
 *
 * The venue is the name Spark already uses when there is one, with the store
 * number kept on it ("H-E-B #725"), so a numbered store stays its own store
 * in reports rather than folding into its chain.
 */
export function draftFormValues(
  draft: PastedDraft,
  catalog: ReadonlyArray<CatalogProduct>,
): DraftFormValues {
  const byUuid = new Map(catalog.map((p) => [p.uuid, p]));
  const productIds: string[] = [];
  const productsToAddByHand: string[] = [];
  for (const product of draft.products) {
    const held = byUuid.get(product.uuid);
    if (held) {
      if (!productIds.includes(held.id)) productIds.push(held.id);
    } else {
      productsToAddByHand.push(product.name);
    }
  }
  const matched = draft.matchedStoreName.trim();
  const venue = matched
    ? draft.storeNumber
      ? `${matched} #${draft.storeNumber}`
      : matched
    : draft.storeName.trim();
  return {
    venue,
    address: draft.address.trim(),
    storeNumber: draft.storeNumber.trim(),
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    notes: draft.notes.trim(),
    productIds,
    productsToAddByHand,
  };
}

/** Street, city, state and a 5-digit ZIP: enough to look the place up. */
export const hasFullAddress = (address: string): boolean =>
  /\b\d{5}\b/.test(address) && address.split(",").length >= 3;

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Friday, November 20, 2026" for "2026-11-20"; "" for anything else. */
export function formatDraftDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const when = new Date(Date.UTC(year, month - 1, day));
  if (when.getUTCMonth() !== month - 1 || when.getUTCDate() !== day) return "";
  return `${WEEKDAYS[when.getUTCDay()]}, ${MONTHS[month - 1]} ${day}, ${year}`;
}

/** "1:30 PM" for "13:30"; "" for anything else. */
export function formatDraftTime(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const hour = Number(m[1]);
  if (hour > 23 || Number(m[2]) > 59) return "";
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** `value`, with what was typed after it when the two differ. */
export function withTyped(value: string, typed: string): string {
  const shown = value.trim();
  const raw = typed.trim();
  if (!shown) return raw ? `Could not read “${raw}”` : "";
  if (!raw || raw.toLowerCase() === shown.toLowerCase()) return shown;
  return `${shown} (typed “${raw}”)`;
}

/** Plain sentences for things the person checking should look at. */
export function draftChecks(draft: PastedDraft, values: DraftFormValues): string[] {
  const out: string[] = [];
  if (draft.date && draft.yearAssumed) {
    out.push(
      `No year was written. ${formatDraftDate(draft.date)} is the next time that date comes round.`,
    );
  }
  if (draft.dateWarning) out.push(draft.dateWarning);
  if (draft.timeAssumed) {
    out.push("AM or PM was missing from one of the times, so it was taken from the other.");
  }
  if (draft.storeName && !draft.matchedStoreName) {
    out.push(
      `“${draft.storeName}” is not a store name already used for this client. Check the spelling.`,
    );
  }
  if (draft.unmatchedProducts.length > 0) {
    out.push(
      `Not in this client's product list, so not selected: ${draft.unmatchedProducts.join(", ")}.`,
    );
  }
  if (values.productsToAddByHand.length > 0) {
    out.push(`Select by hand: ${values.productsToAddByHand.join(", ")}.`);
  }
  return out;
}

export type PasteQueue = { drafts: PastedDraft[]; index: number };

/** The queue after the current draft is submitted or skipped; null when done. */
export function advanceQueue(queue: PasteQueue | null): PasteQueue | null {
  if (!queue) return null;
  const index = queue.index + 1;
  return index < queue.drafts.length ? { drafts: queue.drafts, index } : null;
}

export const queueLabel = (queue: PasteQueue): string =>
  queue.drafts.length === 1
    ? "1 draft"
    : `Draft ${queue.index + 1} of ${queue.drafts.length}`;
