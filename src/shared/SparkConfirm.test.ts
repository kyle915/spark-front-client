import { describe, expect, it } from "vitest";
import { confirmActionClass } from "./sparkConfirmTone";

describe("confirmActionClass", () => {
  it("uses lime primary for default confirms", () => {
    expect(confirmActionClass("default")).toContain("spark-overlay-action-primary");
  });

  it("uses orange for destructive confirms", () => {
    expect(confirmActionClass("danger")).toContain("spark-overlay-action-danger");
  });
});
