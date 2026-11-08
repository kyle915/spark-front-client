/** Inbox page size — server search + cursor Load more (People pattern). */
export const INBOX_PAGE_SIZE = 100;

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
