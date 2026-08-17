import { describe, expect, it } from "vitest";
import {
  defaultRecapStatus,
  recapEmptyKind,
  recapListStatusWord,
  recapMatchesPipeline,
  sharedQueryFilter,
} from "./recapListFilters";

describe("defaultRecapStatus", () => {
  it("defaults the client list to approved, not shared", () => {
    expect(defaultRecapStatus(true)).toBe("approved");
    expect(defaultRecapStatus(true, null)).toBe("approved");
    expect(defaultRecapStatus(true, "shared")).toBe("approved");
    expect(defaultRecapStatus(true, "needs_review")).toBe("approved");
  });

  it("still lets a client ask for every published recap", () => {
    expect(defaultRecapStatus(true, "all")).toBe("all");
  });

  it("keeps admin defaults and URL status", () => {
    expect(defaultRecapStatus(false)).toBe("needs_review");
    expect(defaultRecapStatus(false, "approved")).toBe("approved");
    expect(defaultRecapStatus(false, "shared")).toBe("shared");
  });
});

describe("sharedQueryFilter", () => {
  it("does not send a shared gate for clients", () => {
    expect(sharedQueryFilter(true, "approved")).toBeNull();
    expect(sharedQueryFilter(true, "shared")).toBeNull();
    expect(sharedQueryFilter(true, "all")).toBeNull();
  });

  it("splits admin approved vs shared", () => {
    expect(sharedQueryFilter(false, "approved")).toBe(false);
    expect(sharedQueryFilter(false, "shared")).toBe(true);
    expect(sharedQueryFilter(false, "needs_review")).toBeNull();
  });
});

describe("recapMatchesPipeline", () => {
  const approvedUnshared = {
    approved: true,
    sharedAt: null as string | null,
    justApproved: false,
  };
  const approvedShared = {
    approved: true,
    sharedAt: "2026-08-16T00:00:00Z",
    justApproved: false,
  };
  const draft = {
    approved: false,
    sharedAt: null as string | null,
    justApproved: false,
  };

  it("shows clients every approved recap, including ones never marked shared", () => {
    expect(
      recapMatchesPipeline({
        isClient: true,
        pipeline: "approved",
        ...approvedUnshared,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: true,
        pipeline: "approved",
        ...approvedShared,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: true,
        pipeline: "shared",
        ...approvedUnshared,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({ isClient: true, pipeline: "approved", ...draft }),
    ).toBe(false);
  });

  it("keeps admin approved as not-yet-shared", () => {
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "approved",
        ...approvedUnshared,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "approved",
        ...approvedShared,
      }),
    ).toBe(false);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "shared",
        ...approvedShared,
      }),
    ).toBe(true);
  });
});

describe("recapListStatusWord", () => {
  it("never hardcodes SHARED for the client header", () => {
    expect(recapListStatusWord(true, "approved")).toBe("APPROVED");
    expect(recapListStatusWord(true, "shared")).toBe("APPROVED");
    expect(recapListStatusWord(true, "all")).toBe("ALL");
  });

  it("labels admin pipelines as before", () => {
    expect(recapListStatusWord(false, "shared")).toBe("SHARED");
    expect(recapListStatusWord(false, "approved")).toBe("APPROVED");
    expect(recapListStatusWord(false, "needs_review")).toBe("NEEDS REVIEW");
  });
});

describe("recapEmptyKind", () => {
  it("does not blame filters when the client default window is empty", () => {
    expect(
      recapEmptyKind({
        isClient: true,
        queueEmpty: false,
        filterChips: [{ key: "date" }],
      }),
    ).toBe("window");
    expect(
      recapEmptyKind({
        isClient: true,
        queueEmpty: false,
        filterChips: [],
      }),
    ).toBe("window");
  });

  it("blames filters when the client narrowed the list", () => {
    expect(
      recapEmptyKind({
        isClient: true,
        queueEmpty: false,
        filterChips: [{ key: "date" }, { key: "state" }],
      }),
    ).toBe("filters");
  });

  it("keeps the admin queue empty copy", () => {
    expect(
      recapEmptyKind({
        isClient: false,
        queueEmpty: true,
        filterChips: [{ key: "date" }],
      }),
    ).toBe("queue");
  });
});
