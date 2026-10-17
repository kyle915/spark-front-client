import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecapReviewerSummaryCard } from "./RecapReviewerSummary";

const summary = {
  whatHappened: "Store demo filed 12 engagements.",
  followUpQuestion: "Can you add the photos from this stop?",
  cached: true,
  source: "model",
  looksOff: [
    {
      code: "no_photos",
      label: "No photos attached to this recap.",
      severity: "high",
    },
  ],
  feedback: {
    themes: ["mango flavor"],
    competitorProducts: ["White Claw"],
    objections: ["too expensive"],
    purchaseIntent: "unlikely",
    quotes: ["too expensive next to White Claw"],
  },
};

describe("RecapReviewerSummaryCard", () => {
  it("shows filed prose, rule checks, and a copyable question", () => {
    const html = renderToStaticMarkup(
      <RecapReviewerSummaryCard summary={summary} />,
    );
    expect(html).toContain("Store demo filed 12 engagements.");
    expect(html).toContain("No photos attached to this recap.");
    expect(html).toContain("Can you add the photos from this stop?");
    expect(html).toContain("Copy question");
    expect(html).toContain("White Claw");
    expect(html).toContain("Unlikely to buy");
    expect(html).not.toContain("Approve recap");
    expect(html).toContain('data-recap-reviewer=""');
  });

  it("offers Summarize when the note is still the rule-check draft", () => {
    const html = renderToStaticMarkup(
      <RecapReviewerSummaryCard
        summary={{ ...summary, source: "rules", cached: false }}
        onSummarize={() => {}}
      />,
    );
    expect(html).toContain("Summarize");
    expect(html).toContain("filed fields and rule checks");
  });
});
