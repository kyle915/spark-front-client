import { describe, expect, it } from "vitest";
import {
  bucketsWithItems,
  flattenVisibleItems,
  itemKey,
  nextFocusIndex,
  primaryLine,
  secondaryLine,
  type AttentionStripBucket,
} from "./todayAttentionStripHelpers";

const sample: AttentionStripBucket[] = [
  {
    key: "receipt_checks",
    label: "Receipt checks",
    count: 2,
    items: [
      {
        bucket: "receipt_checks",
        title: "Missing proof",
        subtitle: "Total Wine",
        severity: "high",
        actionUrl: "/finance-queue",
        actionLabel: "Open",
        refId: "aaa",
      },
    ],
  },
  {
    key: "missing_recaps",
    label: "Missing recaps",
    count: 0,
    items: [],
  },
  {
    key: "unstaffed",
    label: "Unstaffed (48h)",
    count: 1,
    items: [
      {
        bucket: "unstaffed",
        title: "Unstaffed · Demo",
        subtitle: "Nov 23 · 4:00 PM",
        severity: "high",
        actionUrl: "/schedule",
        actionLabel: "Staff",
        refId: "bbb",
      },
    ],
  },
];

describe("todayAttentionStripHelpers", () => {
  it("keeps only buckets that still have visible items", () => {
    const kept = bucketsWithItems(sample);
    expect(kept.map((b) => b.key)).toEqual(["receipt_checks", "unstaffed"]);
  });

  it("flattens items in bucket order for keyboard traversal", () => {
    const flat = flattenVisibleItems(bucketsWithItems(sample));
    expect(flat.map((i) => i.refId)).toEqual(["aaa", "bbb"]);
    expect(itemKey(flat[0])).toBe("receipt_checks:aaa");
  });

  it("wraps focus index for up/down navigation", () => {
    expect(nextFocusIndex(0, 1, 3)).toBe(1);
    expect(nextFocusIndex(2, 1, 3)).toBe(0);
    expect(nextFocusIndex(0, -1, 3)).toBe(2);
    expect(nextFocusIndex(-1, 1, 3)).toBe(0);
    expect(nextFocusIndex(0, 1, 0)).toBe(-1);
  });

  it("builds single-line primary and muted secondary copy", () => {
    const item = sample[0].items[0];
    expect(primaryLine(item)).toBe("Missing proof");
    expect(secondaryLine(item)).toBe("HIGH · Total Wine");
  });
});
