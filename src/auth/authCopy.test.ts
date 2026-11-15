import { describe, expect, it } from "vitest";
import { OFFLINE_MESSAGE, failureMessage, newPasswordProblem } from "./authCopy";

describe("account page wording", () => {
  it("turns a dropped connection or a gateway page into one plain sentence", () => {
    expect(failureMessage(new TypeError("Failed to fetch"), "x")).toBe(OFFLINE_MESSAGE);
    expect(failureMessage(new SyntaxError("Unexpected token <"), "x")).toBe(OFFLINE_MESSAGE);
  });

  it("passes on what the server said, and falls back when it said nothing", () => {
    expect(failureMessage(new Error("This link has expired."), "x")).toBe(
      "This link has expired.",
    );
    expect(failureMessage(new Error(""), "Could not save.")).toBe("Could not save.");
    expect(failureMessage("oops", "Could not save.")).toBe("Could not save.");
  });

  it("checks length first, then that the two passwords match", () => {
    expect(newPasswordProblem("short", "short")).toBe("Use at least 8 characters.");
    expect(newPasswordProblem("longenough", "longenoug")).toBe(
      "The two passwords do not match.",
    );
    expect(newPasswordProblem("longenough", "longenough")).toBeNull();
  });
});
