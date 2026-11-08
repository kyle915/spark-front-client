import { describe, expect, it } from "vitest";
import {
  AMBASSADOR_ROSTER_PAGE_SIZE,
  ambassadorEndCursor,
  ambassadorHasMore,
} from "./inviteBaRoster";

describe("inviteBaRoster", () => {
  it("keeps page size at the People/Inbox ceiling", () => {
    expect(AMBASSADOR_ROSTER_PAGE_SIZE).toBeLessThanOrEqual(100);
    expect(AMBASSADOR_ROSTER_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("requires both hasNext and a cursor for Load more", () => {
    expect(ambassadorHasMore({ hasNextPage: true, endCursor: "c1" })).toBe(
      true,
    );
    expect(ambassadorHasMore({ hasNextPage: true, endCursor: null })).toBe(
      false,
    );
    expect(ambassadorHasMore({ hasNextPage: false, endCursor: "c1" })).toBe(
      false,
    );
    expect(ambassadorEndCursor({ endCursor: "abc" })).toBe("abc");
    expect(ambassadorEndCursor(null)).toBeNull();
  });
});
