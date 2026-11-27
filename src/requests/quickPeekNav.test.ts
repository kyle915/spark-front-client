import { describe, expect, it } from "vitest";
import { resolveQuickPeekKeyAction, stepQuickPeekIndex } from "./quickPeekNav";

describe("quickPeekNav", () => {
  it("clamps row stepping within valid bounds", () => {
    expect(stepQuickPeekIndex(-1, 5, 1)).toBe(0);
    expect(stepQuickPeekIndex(0, 5, -1)).toBe(0);
    expect(stepQuickPeekIndex(0, 5, 1)).toBe(1);
    expect(stepQuickPeekIndex(4, 5, 1)).toBe(4);
    expect(stepQuickPeekIndex(2, 0, 1)).toBe(-1);
  });

  it("maps j/k, arrows, a, d, and Enter while ignoring modifier combos", () => {
    expect(resolveQuickPeekKeyAction("j")).toBe("next");
    expect(resolveQuickPeekKeyAction("ArrowDown")).toBe("next");
    expect(resolveQuickPeekKeyAction("k")).toBe("prev");
    expect(resolveQuickPeekKeyAction("ArrowUp")).toBe("prev");
    expect(resolveQuickPeekKeyAction("a")).toBe("approve");
    expect(resolveQuickPeekKeyAction("d")).toBe("decline");
    expect(resolveQuickPeekKeyAction("Enter")).toBe("open_full");
    expect(resolveQuickPeekKeyAction("a", { metaKey: true })).toBeNull();
    expect(resolveQuickPeekKeyAction("j", { ctrlKey: true })).toBeNull();
  });
});
