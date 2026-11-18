import { describe, expect, it } from "vitest";
import { askedWhen, outcomeLabel, sortSources, sourceStatus, sourcesSummary } from "./baProductNotes";

describe("baProductNotes", () => {
  it("labels every outcome the API sends, in sentence case", () => {
    expect(outcomeLabel("answered")).toBe("Answered");
    expect(outcomeLabel("not_in_notes")).toBe("Not in the notes — add it");
    expect(outcomeLabel("no_material")).toBe("No product info yet");
    expect(outcomeLabel("ai_unavailable")).toBe("AI unavailable");
  });
  it("says when a question was asked", () => {
    const now = new Date("2026-11-17T18:00:00Z");
    expect(askedWhen("2026-11-17T17:40:00Z", now)).toBe("20 min ago");
    expect(askedWhen("2026-11-17T15:00:00Z", now)).toBe("3 h ago");
    expect(askedWhen("", now)).toBe("");
  });
});

describe("product sources", () => {
  const now = new Date("2026-11-17T18:00:00Z");
  it("says why a source isn't answering", () => {
    const base = { kind: "website_page", status: "ok", error: "", excluded: false };
    expect(sourceStatus(base)).toBe("");
    expect(sourceStatus({ ...base, excluded: true })).toBe("Excluded from answers");
    expect(sourceStatus({ ...base, status: "empty" })).toBe("No readable text");
    expect(sourceStatus({ ...base, status: "error", error: "timeout" })).toBe("Couldn't read — timed out");
    expect(sourceStatus({ ...base, status: "error", error: "http-404" })).toBe("Couldn't read — error 404");
  });
  it("summarises counts and when they were refreshed", () => {
    expect(
      sourcesSummary("Website", [[12, "page", "pages"], [1, "product", "products"]], "2026-11-17T16:00:00Z", now),
    ).toBe("Website: 12 pages, 1 product · refreshed 2 h ago");
    expect(sourcesSummary("Documents", [[0, "document", "documents"]], "", now)).toBe(
      "Documents: nothing yet · not refreshed yet",
    );
  });
  it("lists the website before documents, homepage first", () => {
    const rows = [
      { kind: "training_doc", label: "From Sell sheet", title: "Sell sheet" },
      { kind: "website_page", label: "From brand.com/pages/faq", title: "FAQ" },
      { kind: "website_page", label: "From brand.com", title: "Home" },
    ];
    expect(sortSources(rows).map((r) => r.title)).toEqual(["Home", "FAQ", "Sell sheet"]);
  });
});
