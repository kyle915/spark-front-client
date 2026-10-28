import { describe, expect, it } from "vitest";
import { CARTO_DARK_TILE, STATUS_COLOR } from "./sparkMapTokens";

describe("sparkMap tokens", () => {
  it("keeps Account Map status colors", () => {
    expect(STATUS_COLOR.recent).toBe("#f2f3ee");
    expect(STATUS_COLOR.scheduled).toBe("#5fb8ef");
    expect(STATUS_COLOR.unvisited).toBe("#ef5a2a");
  });

  it("uses Carto Dark Matter tiles, not an invert hack", () => {
    expect(CARTO_DARK_TILE.url).toContain("basemaps.cartocdn.com/dark_all/");
  });
});
