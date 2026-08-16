import { describe, expect, it } from "vitest";
import { padIndex, recapListKpis, todayGroundKpis } from "./sparkStat";

describe("recapListKpis", () => {
  it("builds in-view / eng / sold / conv from loaded numbers", () => {
    expect(
      recapListKpis({
        filteredTotal: 12,
        loaded: 50,
        total: 80,
        engagements: 200,
        sold: 40,
      }),
    ).toEqual([
      { label: "In view", value: "12", hint: "50 loaded" },
      { label: "Eng", value: "200", tone: "lime" },
      { label: "Sold", value: "40" },
      { label: "Conv", value: "20%", tone: "lime" },
    ]);
  });

  it("never invents conv when engagements are zero", () => {
    const conv = recapListKpis({
      filteredTotal: 3,
      loaded: 3,
      total: 3,
      engagements: 0,
      sold: 8,
    }).find((k) => k.label === "Conv");
    expect(conv).toEqual({ label: "Conv", value: "—", tone: "default" });
  });
});

describe("todayGroundKpis", () => {
  it("oranges live BAs and limes mapped", () => {
    expect(
      todayGroundKpis({ events: 4, liveBas: 2, mapped: 3 }),
    ).toEqual([
      { label: "Events", value: "4" },
      { label: "Live BAs", value: "2", tone: "orange" },
      { label: "Mapped", value: "3", tone: "lime" },
    ]);
  });
});

describe("padIndex", () => {
  it("zero-pads Jump row numbers", () => {
    expect(padIndex(1)).toBe("01");
    expect(padIndex(12)).toBe("12");
  });
});
