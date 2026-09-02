import { describe, expect, it } from "vitest";
import {
  defaultRecapStatus,
  recapEmptyKind,
  recapIsEmptyShell,
  recapListStatusWord,
  recapMatchesBaName,
  recapMatchesPipeline,
  recapsListHrefFromReturn,
  sharedQueryFilter,
  withRecapListReturn,
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

describe("recap list return href", () => {
  it("stashes fromStatus on detail links", () => {
    expect(withRecapListReturn("/recap/view-custom/abc", "approved")).toBe(
      "/recap/view-custom/abc?fromStatus=approved",
    );
    expect(withRecapListReturn("/recap/view/x?x=1", "shared")).toBe(
      "/recap/view/x?x=1&fromStatus=shared",
    );
    expect(withRecapListReturn("/recap/view/x", "draft")).toBe(
      "/recap/view/x?fromStatus=needs_review",
    );
  });

  it("rebuilds the list tab from fromStatus", () => {
    const params = new URLSearchParams("fromStatus=approved&fromPage=3");
    expect(recapsListHrefFromReturn({ searchParams: params })).toBe(
      "/recaps/list?status=approved&page=3",
    );
  });

  it("falls back when fromStatus is missing", () => {
    expect(
      recapsListHrefFromReturn({
        searchParams: new URLSearchParams(),
        fallbackStatus: "shared",
      }),
    ).toBe("/recaps/list?status=shared");
    expect(
      recapsListHrefFromReturn({ searchParams: new URLSearchParams() }),
    ).toBe("/recaps/list");
  });
});

describe("sharedQueryFilter", () => {
  it("does not send a shared gate for clients", () => {
    expect(sharedQueryFilter(true, "approved")).toBeNull();
    expect(sharedQueryFilter(true, "shared")).toBeNull();
    expect(sharedQueryFilter(true, "all")).toBeNull();
  });

  it("only gates shared_at for the admin Shared tab", () => {
    expect(sharedQueryFilter(false, "approved")).toBeNull();
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

  it("shows admin every approved recap, including shared ones", () => {
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
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "shared",
        ...approvedShared,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "shared",
        ...approvedUnshared,
      }),
    ).toBe(false);
  });

  it("hides empty Not filed shells from Needs review but keeps them in Submitted", () => {
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "needs_review",
        ...draft,
        emptyShell: true,
      }),
    ).toBe(false);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "needs_review",
        ...draft,
        emptyShell: false,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "submitted",
        ...draft,
        emptyShell: true,
      }),
    ).toBe(true);
  });
});

describe("recapIsEmptyShell", () => {
  it("treats no photos and no metrics as an empty shell", () => {
    expect(recapIsEmptyShell({ fileCount: 0 })).toBe(true);
    expect(recapIsEmptyShell({ fileCount: 2 })).toBe(false);
    expect(recapIsEmptyShell({ engagements: 0 })).toBe(false);
    expect(recapIsEmptyShell({ heroImage: "https://x/y.jpg" })).toBe(false);
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

describe("recapMatchesBaName", () => {
  it("passes every recap when the BA box is empty", () => {
    expect(recapMatchesBaName("", "VANITA KHAN")).toBe(true);
    expect(recapMatchesBaName("   ", "VANITA KHAN")).toBe(true);
  });

  it("matches a typed first name against the card BA line", () => {
    expect(recapMatchesBaName("Vanita", "VANITA KHAN")).toBe(true);
    expect(recapMatchesBaName("khan", "VANITA KHAN")).toBe(true);
    expect(recapMatchesBaName("Vanita Khan", "VANITA KHAN")).toBe(true);
    expect(recapMatchesBaName("Alex", "VANITA KHAN")).toBe(false);
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
