import { describe, expect, it } from "vitest";
import {
  appendUniqueByUuid,
  recapsListPageVariables,
  RECAPS_PAGE_SIZE,
} from "./recapsListPagination";

describe("recapsListPageVariables", () => {
  it("page 1 asks for 50 rows and no cursor", () => {
    expect(recapsListPageVariables()).toEqual({
      first: RECAPS_PAGE_SIZE,
      after: null,
    });
    expect(recapsListPageVariables(null)).toEqual({
      first: 50,
      after: null,
    });
  });

  it("page 2 keeps first at 50 and sends the page-1 endCursor — not first:100", () => {
    const page1 = recapsListPageVariables(null);
    const page1EndCursor = "cursor:49";
    const page2 = recapsListPageVariables(page1EndCursor);

    expect(page1.first).toBe(50);
    expect(page1.after).toBeNull();

    // Growing `first` is how the list used to "load more". The API clamps
    // first to 50, so first:100 is the same query as page 1 and never
    // returns rows 51–118. Page 2 must be first:50 + after.
    expect(page2.first).toBe(page1.first);
    expect(page2.first).toBe(50);
    expect(page2.after).toBe(page1EndCursor);
    expect(page2).not.toEqual({ first: 100, after: null });
  });
});

describe("appendUniqueByUuid", () => {
  it("concatenates the next page onto the rows already on screen", () => {
    const page1 = [{ uuid: "a" }, { uuid: "b" }];
    const page2 = [{ uuid: "c" }];
    expect(appendUniqueByUuid(page1, page2)).toEqual([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c" },
    ]);
  });

  it("drops overlapping uuids so a retried page does not duplicate cards", () => {
    const loaded = [{ uuid: "a" }, { uuid: "b" }];
    expect(appendUniqueByUuid(loaded, [{ uuid: "b" }, { uuid: "c" }])).toEqual([
      { uuid: "a" },
      { uuid: "b" },
      { uuid: "c" },
    ]);
  });
});
