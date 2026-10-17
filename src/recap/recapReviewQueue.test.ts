import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecapQueueNeighbors,
  loadRecapReviewQueue,
  recapQueueWarmTargets,
  markRecapOpenedInQueue,
  markRecapReviewedInQueue,
  pickNextReviewItem,
  saveRecapReviewQueue,
  type RecapReviewQueueItem,
} from "./recapReviewQueue";

describe("recapReviewQueue", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sampleItems: RecapReviewQueueItem[] = [
    {
      uuid: "u-1",
      isCustom: false,
      href: "/recap/view/u-1?fromStatus=needs_review",
      approved: false,
    },
    {
      uuid: "u-2",
      isCustom: true,
      href: "/recap/view-custom/u-2?fromStatus=needs_review",
      approved: false,
    },
    {
      uuid: "u-3",
      isCustom: false,
      href: "/recap/view/u-3?fromStatus=needs_review",
      approved: true,
    },
    {
      uuid: "u-4",
      isCustom: true,
      href: "/recap/view-custom/u-4?fromStatus=needs_review",
      approved: false,
    },
  ];

  it("saves and loads the review queue from sessionStorage", () => {
    expect(loadRecapReviewQueue()).toBeNull();
    saveRecapReviewQueue({
      items: sampleItems,
      lastOpenedUuid: "u-1",
      returnHref: "/recaps/list?status=needs_review",
    });

    const loaded = loadRecapReviewQueue();
    expect(loaded).not.toBeNull();
    expect(loaded?.items).toHaveLength(4);
    expect(loaded?.lastOpenedUuid).toBe("u-1");
    expect(loaded?.returnHref).toBe("/recaps/list?status=needs_review");
  });

  it("computes Prev, Next, position, and nextUnapproved for the active recap", () => {
    saveRecapReviewQueue({
      items: sampleItems,
      returnHref: "/recaps/list?status=needs_review",
    });

    const first = getRecapQueueNeighbors("u-1");
    expect(first?.index).toBe(1);
    expect(first?.total).toBe(4);
    expect(first?.prev).toBeNull();
    expect(first?.next?.uuid).toBe("u-2");
    expect(first?.nextUnapproved?.uuid).toBe("u-2");

    const second = getRecapQueueNeighbors("u-2");
    expect(second?.index).toBe(2);
    expect(second?.prev?.uuid).toBe("u-1");
    expect(second?.next?.uuid).toBe("u-3");
    // Skips u-3 because u-3 is already approved
    expect(second?.nextUnapproved?.uuid).toBe("u-4");

    const fourth = getRecapQueueNeighbors("u-4");
    expect(fourth?.index).toBe(4);
    expect(fourth?.next).toBeNull();
    // Wraps around to earlier unapproved item u-1
    expect(fourth?.nextUnapproved?.uuid).toBe("u-1");
  });

  it("marks items reviewed and returns null nextUnapproved when queue is all approved", () => {
    saveRecapReviewQueue({
      items: [
        { uuid: "u-1", isCustom: false, href: "/recap/view/u-1", approved: false },
        { uuid: "u-2", isCustom: true, href: "/recap/view-custom/u-2", approved: false },
      ],
    });

    markRecapReviewedInQueue("u-1", { approved: true });
    const afterFirst = getRecapQueueNeighbors("u-1");
    expect(afterFirst?.nextUnapproved?.uuid).toBe("u-2");

    markRecapReviewedInQueue("u-2", { approved: true });
    const afterSecond = getRecapQueueNeighbors("u-2");
    expect(afterSecond?.nextUnapproved).toBeNull();
  });

  it("advances past lastOpenedUuid in pickNextReviewItem", () => {
    const list = [
      { uuid: "u-1", approved: false, archivedAt: null },
      { uuid: "u-2", approved: false, archivedAt: null },
      { uuid: "u-3", approved: false, archivedAt: null },
    ];
    saveRecapReviewQueue({ items: sampleItems });
    markRecapOpenedInQueue("u-1");

    expect(pickNextReviewItem(list)?.uuid).toBe("u-2");
    markRecapOpenedInQueue("u-2");
    expect(pickNextReviewItem(list)?.uuid).toBe("u-3");
    markRecapOpenedInQueue("u-3");
    expect(pickNextReviewItem(list)?.uuid).toBe("u-1");
  });

  it("warms the next recaps before the previous one", () => {
    saveRecapReviewQueue({ items: sampleItems });
    const targets = recapQueueWarmTargets("u-1");
    expect(targets.map((item) => item.uuid).slice(0, 3)).toEqual([
      "u-2",
      "u-3",
      "u-4",
    ]);
    expect(targets.some((item) => item.uuid === "u-1")).toBe(false);
  });
});
