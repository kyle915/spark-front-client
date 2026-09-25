import { describe, expect, it } from "vitest";
import {
  archivedQueryFilter,
  consumeRecapsListNeedsRefresh,
  defaultRecapStatus,
  markRecapsListNeedsRefresh,
  recapEmptyKind,
  recapIsEmptyShell,
  recapListStatusWord,
  recapMatchesBaName,
  recapMatchesPipeline,
  recapsListHrefFromReturn,
  recapsListNavState,
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

  it("stashes fromActivation alongside fromStatus", () => {
    expect(
      withRecapListReturn("/recap/view/x", "approved", "retail"),
    ).toBe("/recap/view/x?fromStatus=approved&fromActivation=retail");
    expect(withRecapListReturn("/recap/view/x", null, "event")).toBe(
      "/recap/view/x?fromActivation=event",
    );
    expect(withRecapListReturn("/recap/view/x", null, "seeding")).toBe(
      "/recap/view/x?fromActivation=seeding",
    );
  });

  it("rebuilds the list tab from fromStatus", () => {
    const params = new URLSearchParams("fromStatus=approved&fromPage=3");
    expect(recapsListHrefFromReturn({ searchParams: params })).toBe(
      "/recaps/list?status=approved&page=3",
    );
  });

  it("restores activation from fromActivation", () => {
    const params = new URLSearchParams(
      "fromStatus=approved&fromActivation=event",
    );
    expect(recapsListHrefFromReturn({ searchParams: params })).toBe(
      "/recaps/list?status=approved&activation=event",
    );
    expect(
      recapsListHrefFromReturn({
        searchParams: new URLSearchParams("fromActivation=seeding"),
      }),
    ).toBe("/recaps/list?activation=seeding");
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

describe("recaps list refresh flag", () => {
  it("marks and consumes a one-shot list refresh", () => {
    sessionStorage.removeItem("spark.recaps.forceListRefresh");
    expect(consumeRecapsListNeedsRefresh()).toBe(false);
    markRecapsListNeedsRefresh();
    expect(consumeRecapsListNeedsRefresh()).toBe(true);
    expect(consumeRecapsListNeedsRefresh()).toBe(false);
  });

  it("builds navigate state for a forced list refetch", () => {
    expect(recapsListNavState(true)).toEqual({ refreshRecaps: true });
    expect(recapsListNavState(true, "Alex")).toEqual({
      baName: "Alex",
      refreshRecaps: true,
    });
    expect(recapsListNavState(false, "Alex")).toEqual({ baName: "Alex" });
    expect(recapsListNavState(false)).toEqual({});
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

describe("archivedQueryFilter", () => {
  it("forces non-archived for clients", () => {
    expect(archivedQueryFilter(true, "approved")).toBe(false);
    expect(archivedQueryFilter(true, "all")).toBe(false);
  });

  it("gates archive on admin Needs review / Approved / Shared / Archived", () => {
    expect(archivedQueryFilter(false, "needs_review")).toBe(false);
    expect(archivedQueryFilter(false, "approved")).toBe(false);
    expect(archivedQueryFilter(false, "shared")).toBe(false);
    expect(archivedQueryFilter(false, "archived")).toBe(true);
    expect(archivedQueryFilter(false, "submitted")).toBeNull();
    expect(archivedQueryFilter(false, "all")).toBeNull();
  });
});

describe("recapMatchesPipeline", () => {
  const approvedUnshared = {
    approved: true,
    sharedAt: null as string | null,
    archivedAt: null as string | null,
    justApproved: false,
  };
  const approvedShared = {
    approved: true,
    sharedAt: "2026-08-16T00:00:00Z",
    archivedAt: null as string | null,
    justApproved: false,
  };
  const draft = {
    approved: false,
    sharedAt: null as string | null,
    archivedAt: null as string | null,
    justApproved: false,
  };
  const archivedDraft = {
    approved: false,
    sharedAt: null as string | null,
    archivedAt: "2026-09-16T00:00:00Z",
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

  it("parks archived out of Needs review / Approved and onto Archived", () => {
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "needs_review",
        ...archivedDraft,
      }),
    ).toBe(false);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "approved",
        ...archivedDraft,
        approved: true,
      }),
    ).toBe(false);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "archived",
        ...archivedDraft,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: false,
        pipeline: "submitted",
        ...archivedDraft,
      }),
    ).toBe(true);
    expect(
      recapMatchesPipeline({
        isClient: true,
        pipeline: "approved",
        ...archivedDraft,
        approved: true,
      }),
    ).toBe(false);
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
    expect(recapListStatusWord(false, "archived")).toBe("ARCHIVED");
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
