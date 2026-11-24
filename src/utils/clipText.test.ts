import { describe, expect, it } from "vitest";
import { clipAtWord, isClipped } from "./clipText";

describe("clipAtWord", () => {
  it("leaves short text alone", () => {
    expect(clipAtWord("Loved the mango flavor.", 40)).toBe("Loved the mango flavor.");
  });

  it("never ends mid-word", () => {
    const text = "It wasn't really the best atmosphere for the demo today";
    expect(clipAtWord(text, 40)).toBe("It wasn't really the best atmosphere…");
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(clipAtWord("Busy store, lots of traffic, great day", 17)).toBe("Busy store…");
  });

  it("hard-cuts one over-long word", () => {
    expect(clipAtWord("x".repeat(30), 10)).toBe(`${"x".repeat(9)}…`);
  });

  it("collapses whitespace", () => {
    expect(clipAtWord("  a\n\n b  ", 10)).toBe("a b");
    expect(isClipped("a b c", 3)).toBe(true);
  });
});
