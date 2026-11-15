import { describe, expect, it } from "vitest";
import { LEGEND_ORDER, STATUS_META } from "./todayMap";
import { statusPinSvg } from "./statusPinSvg";

describe("statusPinSvg", () => {
  it("draws every status, each one differently", () => {
    const drawings = LEGEND_ORDER.map((s) => statusPinSvg(s));
    expect(new Set(drawings).size).toBe(LEGEND_ORDER.length);
    for (const d of drawings) {
      expect(d.startsWith("<svg ")).toBe(true);
      expect(d.endsWith("</svg>")).toBe(true);
    }
  });

  it("uses the status's own shape and colour", () => {
    expect(statusPinSvg("no_show")).toContain("<rect");
    expect(statusPinSvg("late")).toContain("<polygon");
    expect(statusPinSvg("on_clock")).toContain("<circle");
    for (const status of ["no_show", "late", "on_clock", "done", "not_started"] as const) {
      expect(statusPinSvg(status)).toContain(`fill="${STATUS_META[status].color}"`);
    }
  });

  it("draws 'nobody booked' as a hollow ring with a dark edge", () => {
    const ring = statusPinSvg("unstaffed");
    expect(ring).toContain('fill="#ffffff" stroke="#14160f"');
    expect(ring).toContain("M10 14h8");
  });

  it("puts dark ink on the light fills and white on the rest", () => {
    expect(statusPinSvg("late")).toContain('<g stroke="#14160f"');
    expect(statusPinSvg("unstaffed")).toContain('<g stroke="#14160f"');
    expect(statusPinSvg("done")).toContain('<g stroke="#ffffff"');
  });

  it("is drawn at the size asked for (the selected pin is larger)", () => {
    expect(statusPinSvg("done", 38)).toContain('width="38" height="38"');
    expect(statusPinSvg("done")).toContain('width="28" height="28"');
  });
});
