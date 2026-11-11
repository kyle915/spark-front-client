import { describe, expect, it } from "vitest";
import { applyEmailPref, emailPrefsSummary } from "./emailPrefs";

const prefs = [
  { category: "digests", label: "Digests", description: "", emailEnabled: true },
  { category: "mentions", label: "Mentions", description: "", emailEnabled: true },
];

describe("email preferences", () => {
  it("changes only the chosen category", () => {
    const next = applyEmailPref(prefs, "digests", false);
    expect(next.map((p) => p.emailEnabled)).toEqual([false, true]);
    expect(prefs[0].emailEnabled).toBe(true);
  });

  it("ignores an unknown category", () => {
    expect(applyEmailPref(prefs, "nope", false)).toEqual(prefs);
  });

  it("summarises what is off", () => {
    expect(emailPrefsSummary(prefs)).toBe("You're getting every email.");
    expect(emailPrefsSummary(applyEmailPref(prefs, "digests", false))).toBe(
      "1 of 2 turned off.",
    );
    expect(
      emailPrefsSummary(prefs.map((p) => ({ ...p, emailEnabled: false }))),
    ).toBe("All optional emails are off.");
    expect(emailPrefsSummary([])).toBe("");
  });
});
