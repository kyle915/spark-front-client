/** Invite-BA modal roster page size — cursor Load more (People pattern). */
export const AMBASSADOR_ROSTER_PAGE_SIZE = 100;

export type AmbassadorPageInfo =
  | {
      hasNextPage?: boolean | null;
      endCursor?: string | null;
    }
  | null
  | undefined;

export function ambassadorHasMore(pageInfo: AmbassadorPageInfo): boolean {
  return Boolean(pageInfo?.hasNextPage && pageInfo?.endCursor);
}

export function ambassadorEndCursor(
  pageInfo: AmbassadorPageInfo,
): string | null {
  return pageInfo?.endCursor ?? null;
}
