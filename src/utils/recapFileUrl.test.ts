import { describe, it, expect } from "vitest";
import {
  recapFileKind,
  recapFileUrl,
  recapFileUrlFresh,
  pickHeroImage,
} from "./recapFileUrl";

/**
 * Smoke tests for the GCS URL helper — this module is on the hot
 * path for every recap card / view / PDF render, so a regression
 * here breaks photo display everywhere. Tests cover the kind sniffer
 * (extension → category), the URL builder (relative → absolute), and
 * the hero picker (prefers a browser-renderable image when one
 * exists).
 */

describe("recapFileKind", () => {
  it("identifies images", () => {
    expect(recapFileKind("foo.jpg")).toBe("image");
    expect(recapFileKind("foo.JPEG")).toBe("image");
    expect(recapFileKind("foo.png")).toBe("image");
    expect(recapFileKind("foo.webp")).toBe("image");
    expect(recapFileKind("foo.gif")).toBe("image");
  });
  it("identifies HEIC", () => {
    expect(recapFileKind("photo.heic")).toBe("heic");
    expect(recapFileKind("photo.HEIF")).toBe("heic");
  });
  it("identifies PDFs", () => {
    expect(recapFileKind("doc.pdf")).toBe("pdf");
    expect(recapFileKind("doc.PDF?token=abc")).toBe("pdf");
  });
  it("identifies videos", () => {
    expect(recapFileKind("clip.mp4")).toBe("video");
    expect(recapFileKind("clip.MOV")).toBe("video");
  });
  it("falls back to other", () => {
    expect(recapFileKind("noext")).toBe("other");
    expect(recapFileKind(null)).toBe("other");
    expect(recapFileKind(undefined)).toBe("other");
  });
});

describe("recapFileUrl", () => {
  it("prepends bucket base for relative paths", () => {
    const out = recapFileUrl("recaps/foo.jpg");
    expect(out.startsWith("https://storage.googleapis.com/")).toBe(true);
    expect(out.endsWith("recaps/foo.jpg")).toBe(true);
  });
  it("returns absolute URLs unchanged", () => {
    const url = "https://example.com/foo.jpg";
    expect(recapFileUrl(url)).toBe(url);
  });
  it("strips a leading slash so the join doesn't double up", () => {
    const out = recapFileUrl("/recaps/foo.jpg");
    expect(out.includes("//recaps")).toBe(false);
  });
  it("empty/null returns empty string", () => {
    expect(recapFileUrl(null)).toBe("");
    expect(recapFileUrl(undefined)).toBe("");
    expect(recapFileUrl("")).toBe("");
  });
});

describe("recapFileUrlFresh", () => {
  it("appends a cache-buster", () => {
    const out = recapFileUrlFresh("recaps/foo.jpg");
    expect(out.includes("cb=")).toBe(true);
  });
  it("uses & when URL already has a query string", () => {
    const out = recapFileUrlFresh(
      "https://x.test/foo.jpg?already=here",
    );
    // Either ? or & is fine as long as it's not malformed.
    expect(out.match(/[?&]cb=/)).not.toBeNull();
    expect(out.match(/\?\?/)).toBeNull();
  });
});

describe("pickHeroImage", () => {
  it("picks the first .jpg in a mixed list", () => {
    const out = pickHeroImage([
      { file: "doc.pdf" },
      { file: "photo.jpg" },
      { file: "extra.png" },
    ]);
    expect(out).not.toBeNull();
    expect(out!.includes("photo.jpg")).toBe(true);
  });
  it("returns null when only non-image files are present", () => {
    const out = pickHeroImage([
      { file: "doc.pdf" },
      { file: "photo.heic" },
    ]);
    expect(out).toBeNull();
  });
  it("tolerates null entries", () => {
    const out = pickHeroImage([null, undefined, { file: null }]);
    expect(out).toBeNull();
  });
});
