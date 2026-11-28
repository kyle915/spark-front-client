/** Inbox page size — server search + cursor Load more (People pattern). */
export const INBOX_PAGE_SIZE = 100;

export type InboxKind = "sla" | "pending" | "declined";
export type InboxFilterTab = "all" | InboxKind;

export type InboxPageInfo = {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
} | null | undefined;

export function inboxEndCursor(pageInfo: InboxPageInfo): string | null {
  const cursor = pageInfo?.endCursor;
  return typeof cursor === "string" && cursor.length > 0 ? cursor : null;
}

export function inboxHasMore(pageInfo: InboxPageInfo): boolean {
  return Boolean(pageInfo?.hasNextPage) && inboxEndCursor(pageInfo) !== null;
}

export function mergeInboxByUuid<T extends { uuid: string }>(
  base: T[],
  extra: T[],
): T[] {
  if (extra.length === 0) return base;
  const seen = new Set(base.map((row) => row.uuid));
  const appended = extra.filter((row) => !seen.has(row.uuid));
  return appended.length === 0 ? base : [...base, ...appended];
}

export function filterInboxItems<T extends { kind: InboxKind }>(
  items: readonly T[],
  tab: InboxFilterTab,
): T[] {
  if (tab === "all") return [...items];
  return items.filter((item) => item.kind === tab);
}

export function stepInboxFocusIndex(
  current: number,
  total: number,
  delta: -1 | 1,
): number {
  if (total <= 0) return 0;
  if (current < 0) return delta > 0 ? 0 : total - 1;
  return Math.max(0, Math.min(total - 1, current + delta));
}

export function approvableSelectedUuids<
  T extends { uuid: string; kind: InboxKind },
>(items: readonly T[], selected: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (selected.has(it.uuid) && (it.kind === "sla" || it.kind === "pending")) {
      out.push(it.uuid);
    }
  }
  return out;
}
