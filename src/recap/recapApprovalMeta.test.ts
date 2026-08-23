import { describe, expect, it } from "vitest";

import { recapApprovalMeta, recapApproverName } from "./recapApprovalMeta";

describe("recapApproverName", () => {
  it("prefers first and last name", () => {
    expect(
      recapApproverName({ firstName: "Kyle", lastName: "C", email: "k@x.com" }),
    ).toBe("Kyle C");
  });

  it("falls back to email", () => {
    expect(recapApproverName({ email: "ops@igniteproductions.co" })).toBe(
      "ops@igniteproductions.co",
    );
  });
});

describe("recapApprovalMeta", () => {
  it("returns null for unapproved recaps", () => {
    expect(
      recapApprovalMeta(false, { firstName: "Ada" }, "2026-08-23T12:00:00Z"),
    ).toBeNull();
  });

  it("includes approver and timestamp when both exist", () => {
    const text = recapApprovalMeta(
      true,
      { firstName: "Ada", lastName: "Min" },
      "2026-08-23T12:00:00Z",
    );
    expect(text).toMatch(/^Approved by Ada Min · /);
  });
});
