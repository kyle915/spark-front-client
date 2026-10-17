import { describe, expect, it, vi } from "vitest";
import {
  archivedQueryFilter,
  buildRecapListSearchParams,
  consumeRecapsListNeedsRefresh,
  defaultRecapStatus,
  markRecapsListNeedsRefresh,
  readRecapListUrlFilters,
  recapEmptyKind,
  recapIsEmptyShell,
  recapListServerFilters,
  recapListStatusWord,
  recapMatchesBaName,
  recapMatchesPipeline,
  recapTypeChips,
  recapsListHrefFromReturn,
  recapsListNavState,
  sharedQueryFilter,
  withRecapListReturn,
} from "./recapListFilters";

describe("recapListServerFilters", () => {
  const base = {
    tenantId: "T1",
    isClient: false,
    statusFilter: "needs_review" as const,
    rmmFilter: "all",
    baName: "  ",
    retailerFilter: "all",
    stateFilter: "all",
    dateFrom: "2026-09-07",
    dateTo: "",
    activationFilter: "all" as const,
  };

  it("sends the type chip as recapType", () => {
    expect(recapListServerFilters(base).recapType).toBeNull();
    expect(
      recapListServerFilters({ ...base, activationFilter: "guerilla" })
        .recapType,
    ).toBe("guerilla");
  });

  it("maps status, dates and dropdowns like the list always has", () => {
    expect(recapListServerFilters(base)).toEqual({
      tenantId: "T1",
      rmmAsignedId: null,
      ambassadorId: null,
      ambassadorName: null,
      approved: false,
      shared: null,
      archived: false,
      retailerName: null,
      stateCode: null,
      startDate: "2026-09-07",
      endDate: null,
      recapType: null,
    });
    expect(
      recapListServerFilters({
        ...base,
        statusFilter: "shared",
        retailerFilter: "Binny's",
        stateFilter: "IL",
        baName: " Weni ",
      }),
    ).toMatchObject({
      approved: true,
      shared: true,
      retailerName: "Binny's",
      stateCode: "IL",
      ambassadorName: "Weni",
    });
    expect(
      recapListServerFilters({ ...base, statusFilter: "archived" }),
    ).toMatchObject({ approved: null, archived: true });
  });

  it("client view is approved-only", () => {
    expect(
      recapListServerFilters({ ...base, isClient: true, statusFilter: "all" }),
    ).toMatchObject({ approved: true, shared: null, archived: false });
  });
});

describe("recapTypeChips", () => {
  const torch = {
    total: 41,
    types: [
      { key: "retail", label: "Retail", count: 30 },
      { key: "event", label: "Event", count: 6 },
      { key: "guerilla", label: "Guerilla", count: 3 },
      { key: "seeding", label: "Seeding", count: 2 },
    ],
  };

  it("lists All plus the tenant's types with counts", () => {
    expect(recapTypeChips(torch, "all")).toEqual([
      { key: "all", label: "All", count: 41 },
      { key: "retail", label: "Retail", count: 30 },
      { key: "event", label: "Event", count: 6 },
      { key: "guerilla", label: "Guerilla", count: 3 },
      { key: "seeding", label: "Seeding", count: 2 },
    ]);
  });

  it("hides for a single-type tenant", () => {
    expect(
      recapTypeChips(
        { total: 12, types: [{ key: "retail", label: "Retail", count: 12 }] },
        "all",
      ),
    ).toEqual([]);
    expect(recapTypeChips(null, "all")).toEqual([]);
  });

  it("keeps a picked type the tenant lacks so it can be cleared", () => {
    expect(
      recapTypeChips(
        { total: 12, types: [{ key: "retail", label: "Retail", count: 12 }] },
        "guerilla",
      ),
    ).toEqual([
      { key: "all", label: "All", count: 12 },
      { key: "retail", label: "Retail", count: 12 },
      { key: "guerilla", label: "Guerilla", count: 0 },
    ]);
    expect(recapTypeChips(null, "seeding")).toEqual([
      { key: "all", label: "All", count: null },
      { key: "seeding", label: "Seeding", count: null },
    ]);
  });

  it("drops keys this build doesn't know", () => {
    expect(
      recapTypeChips(
        {
          total: 5,
          types: [
            { key: "retail", label: "Retail", count: 3 },
            { key: "mystery", label: "Mystery", count: 2 },
          ],
        },
        "all",
      ),
    ).toEqual([]);
  });
});

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

  it("stashes and restores search, retailer, state, rmm, ba, dates, and page", () => {
    const detailHref = withRecapListReturn(
      "/recap/view-custom/abc",
      "needs_review",
      "retail",
      {
        q: "heb",
        retailer: "H-E-B",
        state: "TX",
        rmm: "42",
        ba: "Alex",
        from: "2026-09-01",
        to: "2026-09-30",
        page: 2,
      },
    );
    expect(detailHref).toContain("fromQ=heb");
    expect(detailHref).toContain("fromRetailer=H-E-B");
    expect(detailHref).toContain("fromState=TX");
    expect(detailHref).toContain("fromRmm=42");
    expect(detailHref).toContain("fromBa=Alex");
    expect(detailHref).toContain("fromFrom=2026-09-01");
    expect(detailHref).toContain("fromTo=2026-09-30");
    expect(detailHref).toContain("fromPage=2");

    const [, query = ""] = detailHref.split("?");
    expect(
      recapsListHrefFromReturn({ searchParams: new URLSearchParams(query) }),
    ).toBe(
      "/recaps/list?status=needs_review&activation=retail&q=heb&retailer=H-E-B&state=TX&rmm=42&ba=Alex&from=2026-09-01&to=2026-09-30&page=2",
    );
  });

  it("reads and writes URL search params while omitting default values", () => {
    const defaults = {
      isClient: false,
      defaultFrom: "2026-09-17",
      defaultTo: "2026-10-17",
      weekFrom: "2026-10-10",
    };
    const cleanParams = buildRecapListSearchParams({
      ...defaults,
      status: "needs_review",
      activation: "all",
      q: "  ",
      retailer: "all",
      state: "all",
      rmm: "all",
      ba: "",
      from: "2026-09-17",
      to: "2026-10-17",
      page: 1,
    });
    expect(cleanParams.toString()).toBe("");

    const activeParams = buildRecapListSearchParams({
      ...defaults,
      status: "approved",
      activation: "event",
      q: " Costco ",
      retailer: "Costco",
      state: "CA",
      rmm: "7",
      ba: "Weni",
      from: "2026-08-01",
      to: "2026-08-31",
      page: 3,
    });
    expect(activeParams.toString()).toBe(
      "status=approved&activation=event&q=Costco&retailer=Costco&state=CA&rmm=7&ba=Weni&from=2026-08-01&to=2026-08-31&page=3",
    );

    const parsed = readRecapListUrlFilters(activeParams, defaults);
    expect(parsed).toEqual({
      status: "approved",
      activation: "event",
      q: "Costco",
      retailer: "Costco",
      state: "CA",
      rmm: "7",
      ba: "Weni",
      from: "2026-08-01",
      to: "2026-08-31",
      page: 3,
    });
  });
});

describe("recaps list refresh flag", () => {
  it("marks and consumes a one-shot list refresh", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    expect(consumeRecapsListNeedsRefresh()).toBe(false);
    markRecapsListNeedsRefresh();
    expect(consumeRecapsListNeedsRefresh()).toBe(true);
    expect(consumeRecapsListNeedsRefresh()).toBe(false);
    vi.unstubAllGlobals();
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
