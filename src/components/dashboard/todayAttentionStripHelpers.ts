/**
 * Pure helpers for the condensed Today's attention strip.
 * Kept free of Relay so vitest can cover density + keyboard math without
 * compiling GraphQL.
 */

export type AttentionStripItem = {
  bucket: string;
  title: string;
  subtitle: string;
  severity: string;
  actionUrl: string;
  actionLabel: string;
  refId: string;
};

export type AttentionStripBucket = {
  key: string;
  label: string;
  count: number;
  items: AttentionStripItem[];
};

export const BUCKET_VIEW_ALL: Record<string, string> = {
  receipt_checks: "/finance-queue",
  missing_recaps: "/recaps/missing",
  unstaffed: "/schedule",
  rebooks: "/buyer-report",
};

export function itemKey(item: Pick<AttentionStripItem, "bucket" | "refId">): string {
  return `${item.bucket}:${item.refId}`;
}

export function bucketsWithItems(
  buckets: ReadonlyArray<AttentionStripBucket | null | undefined> | null | undefined,
): AttentionStripBucket[] {
  return (buckets ?? []).filter(
    (b): b is AttentionStripBucket => Boolean(b && (b.items?.length ?? 0) > 0),
  );
}

/** Flat list of visible items in bucket order — for keyboard focus. */
export function flattenVisibleItems(
  buckets: ReadonlyArray<AttentionStripBucket>,
): AttentionStripItem[] {
  return buckets.flatMap((b) => b.items);
}

export function nextFocusIndex(
  current: number,
  delta: number,
  length: number,
): number {
  if (length <= 0) return -1;
  if (current < 0) return delta >= 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}

export function primaryLine(item: AttentionStripItem): string {
  return (item.title || "").trim();
}

export function secondaryLine(item: AttentionStripItem): string {
  const sev = (item.severity || "").trim().toUpperCase();
  const sub = (item.subtitle || "").trim();
  if (sev && sub) return `${sev} · ${sub}`;
  return sev || sub;
}
