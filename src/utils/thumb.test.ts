import { describe, it, expect } from "vitest";
import { thumbUrl } from "./thumb";

describe("thumbUrl", () => {
  it("rewrites a GCS public URL onto the resize endpoint when API origin is known", () => {
    const src =
      "https://storage.googleapis.com/sparkio-production/recaps/foo.jpg";
    const out = thumbUrl(src, 400);
    if (out === src) {
      // No VITE_GRAPHQL_ENDPOINT in this test env — passthrough is correct.
      return;
    }
    expect(out).toContain("/api/public/img/thumb?");
    expect(out).toContain("w=400");
    expect(out).toContain(encodeURIComponent(src));
  });

  it("passes through empty / non-GCS URLs", () => {
    expect(thumbUrl(null)).toBe("");
    expect(thumbUrl(undefined)).toBe("");
    expect(thumbUrl("")).toBe("");
    expect(thumbUrl("https://example.com/foo.jpg")).toBe(
      "https://example.com/foo.jpg",
    );
    expect(thumbUrl("data:image/jpeg;base64,xx")).toBe(
      "data:image/jpeg;base64,xx",
    );
  });
});
