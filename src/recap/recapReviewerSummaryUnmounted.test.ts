import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const recapDir = dirname(fileURLToPath(import.meta.url));

function source(name: string) {
  return readFileSync(join(recapDir, name), "utf8");
}

describe("reviewer summary card is unmounted", () => {
  it("does not mount the card on standard or custom recap pages", () => {
    for (const file of ["SparkRecapView.tsx", "RecapCustomView.tsx"]) {
      const text = source(file);
      expect(text).not.toContain("RecapReviewerSummary");
      expect(text).not.toContain("Reviewer summary");
      expect(text).not.toContain("Copy question");
      expect(text).toContain("RecapReviewChecks");
    }
  });

  it("does not render the card on the recap paper", () => {
    const text = source("RecapDocument.tsx");
    expect(text).not.toContain("RecapReviewerSummary");
    expect(text).not.toContain("Reviewer summary");
    expect(text).not.toContain("Copy question");
  });
});
