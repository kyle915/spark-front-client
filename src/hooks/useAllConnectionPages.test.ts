import { describe, expect, it } from "vitest";
import {
  connectionNodes,
  mergeConnectionPages,
  wantsAnotherPage,
} from "./useAllConnectionPages";

describe("connection paging helpers", () => {
  it("reads nodes and drops empty edges", () => {
    expect(
      connectionNodes({ edges: [{ node: { id: "1" } }, null, { node: null }] }),
    ).toEqual([{ id: "1" }]);
    expect(connectionNodes(null)).toEqual([]);
  });

  it("merges pages, de-duplicates by id and stops at the cap", () => {
    const a = [{ id: "1" }, { id: "2" }];
    const b = [{ id: "2" }, { id: "3" }, { id: "4" }];
    expect(mergeConnectionPages([a, b]).map((n) => n.id)).toEqual(["1", "2", "3", "4"]);
    expect(mergeConnectionPages([a, b], 3).map((n) => n.id)).toEqual(["1", "2", "3"]);
  });

  it("asks for another page only while the server has more and we want more", () => {
    const more = { pageInfo: { hasNextPage: true, endCursor: "c" } };
    // A brand user asked for 1000, got the clamped 200: keep going.
    expect(wantsAnotherPage(more, 200, 1000)).toBe(true);
    // An admin asked for 1000 and got 1000: done, same single request as before.
    expect(wantsAnotherPage(more, 1000, 1000)).toBe(false);
    expect(wantsAnotherPage({ pageInfo: { hasNextPage: false, endCursor: "c" } }, 10, 1000)).toBe(false);
    expect(wantsAnotherPage({ pageInfo: { hasNextPage: true, endCursor: null } }, 10, 1000)).toBe(false);
  });
});
