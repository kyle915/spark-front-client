import { describe, expect, it } from "vitest";
import { blockedReason, looksLikeEmail, primaryLabel } from "./signInSteps";

describe("sign-in steps", () => {
  it("accepts a plain email and rejects a half-typed one", () => {
    expect(looksLikeEmail(" kyle@example.com ")).toBe(true);
    expect(looksLikeEmail("kyle@example")).toBe(false);
    expect(looksLikeEmail("kyle example.com")).toBe(false);
  });

  it("asks for the email first, then the password only in password mode", () => {
    expect(blockedReason("link", "", "")).toBe("Enter your email.");
    expect(blockedReason("link", "a@b.co", "")).toBeNull();
    expect(blockedReason("password", "a@b.co", "")).toBe("Enter your password.");
    expect(blockedReason("password", "a@b.co", "x")).toBeNull();
  });

  it("names the button by what it does", () => {
    expect(primaryLabel("link", false)).toBe("Email me a sign-in link");
    expect(primaryLabel("password", true)).toBe("Signing in…");
  });
});
