import { describe, expect, it } from "vitest";
import {
  clientSafeBaName,
  isWalkupPlaceholderEmail,
  walkupPhoneFromEmail,
} from "./clientSafeBaName";

describe("clientSafeBaName", () => {
  it("shortens a full name to first name + last initial", () => {
    expect(clientSafeBaName("Jason Bailey")).toBe("Jason B.");
    expect(clientSafeBaName("  Maria de la Cruz ")).toBe("Maria C.");
  });
  it("keeps a single name and blanks", () => {
    expect(clientSafeBaName("Cher")).toBe("Cher");
    expect(clientSafeBaName("")).toBe("");
    expect(clientSafeBaName(null)).toBe("");
  });
  it("never leaks an email", () => {
    expect(clientSafeBaName("ba@example.com")).toBe("Ambassador");
    expect(clientSafeBaName("checkin-3127719621@walkup.spark")).toBe("Ambassador");
  });
});

describe("walk-up placeholder emails", () => {
  it("detects placeholders", () => {
    expect(isWalkupPlaceholderEmail("checkin-3127719621@walkup.spark")).toBe(true);
    expect(isWalkupPlaceholderEmail("nev@igniteproductions.co")).toBe(false);
  });
  it("formats the phone", () => {
    expect(walkupPhoneFromEmail("checkin-3127719621@walkup.spark")).toBe("(312) 771-9621");
    expect(walkupPhoneFromEmail("checkin-13127719621@walkup.spark")).toBe("(312) 771-9621");
    expect(walkupPhoneFromEmail("checkin-1111@walkup.spark")).toBe("");
    expect(walkupPhoneFromEmail("a@b.co")).toBe("");
  });
});
