import { describe, expect, it } from "vitest";
import { displayEmail, talentMatches, talentName, talentPlace } from "./talentDisplay";

const walkup = {
  firstName: "",
  lastName: "",
  email: "checkin-3127719621@walkup.spark",
  phone: null,
  lastWorkedMarket: "Austin, TX",
  lastWorkedTenant: "Liquid Death",
};

describe("talent roster display", () => {
  it("never shows the synthetic walk-up email", () => {
    expect(displayEmail(walkup.email)).toBe("");
    expect(talentName(walkup)).toBe("(312) 771-9621");
    expect(talentPlace(walkup, "")).toBe("Austin, TX · Liquid Death");
    expect(talentName(walkup)).not.toContain("walkup.spark");
  });

  it("keeps real names and emails", () => {
    const ba = { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com" };
    expect(talentName(ba)).toBe("Ana Ruiz");
    expect(displayEmail(ba.email)).toBe("ana@example.com");
  });

  it("finds a walk-up by phone in any format, not by the placeholder", () => {
    expect(talentMatches(walkup, "", "312-771")).toBe(true);
    expect(talentMatches(walkup, "", "(312) 771-9621")).toBe(true);
    expect(talentMatches(walkup, "", "walkup")).toBe(false);
    expect(talentMatches(walkup, "", "austin")).toBe(true);
  });

  it("formats a stored phone", () => {
    expect(talentName({ phone: "+1 555 123 4567" })).toBe("(555) 123-4567");
  });
});
