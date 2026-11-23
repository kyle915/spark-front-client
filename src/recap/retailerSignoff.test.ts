import { describe, expect, it } from "vitest";
import {
  clerkFirstNameError,
  isLetterType,
  isSignatureType,
  letterValue,
  signatureError,
  signatureSrc,
} from "./retailerSignoff";

describe("retailer sign-off", () => {
  it("keeps last initial to one letter", () => {
    expect(letterValue("m")).toBe("M");
    expect(letterValue("3")).toBe("");
    expect(letterValue("")).toBe("");
    expect(isLetterType("letter")).toBe(true);
    expect(isLetterType("text")).toBe(false);
    expect(isLetterType("initial")).toBe(false);
  });

  it("accepts a clerk first name and refuses a number", () => {
    expect(clerkFirstNameError(" Mary Ann ")).toBeNull();
    expect(clerkFirstNameError("José")).toBeNull();
    expect(clerkFirstNameError("Alex2")).toBe("Enter the clerk's first name.");
    expect(clerkFirstNameError("")).toBe("Enter the clerk's first name.");
  });

  it("only treats a png data url as a signature", () => {
    expect(isSignatureType("signature")).toBe(true);
    expect(isSignatureType("image")).toBe(false);
    expect(signatureSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(signatureSrc("hello")).toBeNull();
    expect(signatureError("", true)).toBe("The store clerk needs to sign.");
    expect(signatureError("", false)).toBeNull();
    expect(signatureError("not-a-signature")).toMatch(/couldn't be read/);
  });
});
