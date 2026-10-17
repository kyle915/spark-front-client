import { describe, expect, it } from "vitest";
import { MAX_RECAP_COMMENT_LENGTH, validateRecapComment } from "./recapCommentValidation";

describe("validateRecapComment", () => {
  it("rejects empty and over-long comments", () => {
    expect(validateRecapComment("   ")).toMatch(/Write a comment/);
    expect(validateRecapComment("x".repeat(MAX_RECAP_COMMENT_LENGTH + 1))).toMatch(/Keep it under/);
  });

  it("accepts a normal question", () => {
    expect(validateRecapComment("Can we get one more shelf photo?")).toBeNull();
  });
});
