import { describe, expect, it } from "vitest";
import {
  INBOX_PAGE_SIZE,
  inboxEndCursor,
  inboxHasMore,
  mergeInboxByUuid,
} from "./inboxListFilters";

describe("inboxListFilters", () => {
  it("keeps page size at the server users/requests cap", () => {
    expect(INBOX_PAGE_SIZE).toBeLessThanOrEqual(100);
    expect(INBOX_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("reads end cursor only when present", () => {
    expect(inboxEndCursor(null)).toBeNull();
    expect(inboxEndCursor({ hasNextPage: true, endCursor: "" })).toBeNull();
    expect(
      inboxEndCursor({ hasNextPage: true, endCursor: "abc" }),
    ).toBe("abc");
  });

  it("requires both hasNext and a cursor for Load more", () => {
    expect(inboxHasMore({ hasNextPage: true, endCursor: null })).toBe(false);
    expect(inboxHasMore({ hasNextPage: false, endCursor: "x" })).toBe(false);
    expect(inboxHasMore({ hasNextPage: true, endCursor: "x" })).toBe(true);
  });

  it("merges by uuid without duplicates", () => {
    const a = [{ uuid: "1" }, { uuid: "2" }];
    const b = [{ uuid: "2" }, { uuid: "3" }];
    expect(mergeInboxByUuid(a, b).map((r) => r.uuid)).toEqual(["1", "2", "3"]);
  });
});
