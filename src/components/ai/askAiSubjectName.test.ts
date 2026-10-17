import { describe, expect, it } from "vitest";
import {
  askAiModalTitle,
  askAiSubjectFromTenant,
  askAiSubjectName,
} from "./askAiSubjectName";

describe("askAiSubjectName", () => {
  it("keeps the tenant switcher display name", () => {
    expect(askAiSubjectName("Brand Revolution")).toBe("Brand Revolution");
  });

  it("keeps punctuation and digits inside real brand names", () => {
    expect(askAiSubjectName("Brew Dr.")).toBe("Brew Dr.");
    expect(askAiSubjectName("  O.G.  ")).toBe("O.G.");
    expect(askAiSubjectName("7-Eleven")).toBe("7-Eleven");
    expect(askAiSubjectName("AT&T")).toBe("AT&T");
  });

  it("strips leading invisible, private-use, and bullet junk", () => {
    expect(askAiSubjectName("\u200BBrand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("\uFEFFBrand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("\uE000Brand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("\u00ADBrand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("· Brand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("✨ Brand Revolution")).toBe("Brand Revolution");
  });

  it("decodes a leading HTML entity before stripping it", () => {
    expect(askAiSubjectName("&#8203;Brand Revolution")).toBe("Brand Revolution");
    expect(askAiSubjectName("&#xE000;Brand Revolution")).toBe(
      "Brand Revolution",
    );
    expect(askAiSubjectName("&shy;Brew Dr.")).toBe("Brew Dr.");
  });

  it("returns empty when there is no display name", () => {
    expect(askAiSubjectName("")).toBe("");
    expect(askAiSubjectName("   ")).toBe("");
    expect(askAiSubjectName(null)).toBe("");
    expect(askAiSubjectName("—")).toBe("");
  });
});

describe("askAiSubjectFromTenant", () => {
  it("uses the display name and ignores the spark-form slug prefix", () => {
    expect(
      askAiSubjectFromTenant({
        name: "Brand Revolution",
        requestUrlName: "jgwf-brand-revolution",
      }),
    ).toBe("Brand Revolution");
  });

  it("does not title-case the slug when the display name is missing", () => {
    expect(
      askAiSubjectFromTenant({
        name: null,
        requestUrlName: "jgwf-brand-revolution",
      }),
    ).toBe("");
  });
});

describe("askAiModalTitle", () => {
  it("builds the modal title from the clean display name", () => {
    expect(askAiModalTitle("Brand Revolution")).toBe(
      "Ask about Brand Revolution.",
    );
    expect(askAiModalTitle("\uE000Brew Dr.")).toBe("Ask about Brew Dr.");
    expect(askAiModalTitle("O.G.")).toBe("Ask about O.G.");
    expect(askAiModalTitle("")).toBe("Ask about this client.");
  });
});
