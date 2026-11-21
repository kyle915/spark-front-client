/**
 * "Store changed by BA from X to Y at 2:14 PM" on a Walk-ups card.
 *
 * The BA can move their own walk-in shift to the store they are really at
 * from the check-in page ("Wrong store? Fix it"). Staff see the latest move
 * here, whether the BA overrode a far-from-GPS warning, and when the move
 * created a store Spark had never seen (unverified: review, rename or merge
 * it from the retailer page).
 */
export type StoreChangeFields = {
  storeChangedFrom?: string | null;
  storeChangedTo?: string | null;
  storeChangedAt?: string | null;
  storeChangeDistanceKm?: number | null;
  storeChangeFarOverride?: boolean | null;
  storeChangeCreatedStore?: boolean | null;
  storeChangeRetailerUuid?: string | null;
};

const defaultTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function storeChangeNote(
  row: StoreChangeFields,
  formatTime: (iso: string) => string = defaultTime,
): string | null {
  const to = (row.storeChangedTo ?? "").trim();
  if (!to) return null;
  const from = (row.storeChangedFrom ?? "").trim();
  const at = row.storeChangedAt ? formatTime(row.storeChangedAt) : "";
  return [
    "Store changed by BA",
    from ? `from ${from}` : "",
    `to ${to}`,
    at ? `at ${at}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** "Said they were sure: 2.1 mi from their phone's GPS". */
export function storeChangeOverrideNote(row: StoreChangeFields): string | null {
  if (!row.storeChangeFarOverride) return null;
  const km = row.storeChangeDistanceKm;
  if (km == null || !Number.isFinite(km)) return "Moved despite a far-from-GPS warning";
  const mi = km * 0.621371;
  return `Moved despite a far-from-GPS warning (${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi from their phone)`;
}

/** Link to the store the move created, for staff to rename or merge it. */
export function createdStoreLink(row: StoreChangeFields): string | null {
  if (!row.storeChangeCreatedStore || !row.storeChangeRetailerUuid) return null;
  return `/catalogs/retailers/edit/${encodeURIComponent(row.storeChangeRetailerUuid)}`;
}
