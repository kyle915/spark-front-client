import { describe, expect, it } from "vitest";
import { matchesStandingCodeQuery } from "./standingCodeSearch";

const liquidDeath = {
  name: "Liquid Death",
  code: "LD-TNBJ8K",
  teamCode: null,
  teamTitle: null,
  programs: ["Retail", "Event", "Product Seeding"],
};

describe("matchesStandingCodeQuery", () => {
  it("matches a brand or a code without reminting anything", () => {
    expect(matchesStandingCodeQuery("", liquidDeath)).toBe(true);
    expect(matchesStandingCodeQuery("death", liquidDeath)).toBe(true);
    expect(matchesStandingCodeQuery("ld-tnbj", liquidDeath)).toBe(true);
    expect(matchesStandingCodeQuery("seeding", liquidDeath)).toBe(true);
    expect(matchesStandingCodeQuery("dude wipes", liquidDeath)).toBe(false);
  });
});
