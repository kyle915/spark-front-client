import { describe, it, expect } from "vitest";
import {
  recapFileKind,
  recapFileUrl,
  recapDisplayUrl,
  recapFileUrlFresh,
  pickHeroImage,
  recapGallerySlot,
  recapVideoMime,
  recapVideoPlayUrl,
  browserPlayableContentType,
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
    expect(recapFileKind("clip.mov?cb=1")).toBe("video");
    expect(recapFileKind("clip.m4v")).toBe("video");
  });
  it("falls back to other", () => {
    expect(recapFileKind("noext")).toBe("other");
    expect(recapFileKind(null)).toBe("other");
    expect(recapFileKind(undefined)).toBe("other");
  });
});

describe("recapGallerySlot", () => {
  const mov =
    "https://storage.googleapis.com/sparkio-production/checkin/clip.mov";
  const jpg =
    "https://storage.googleapis.com/sparkio-production/checkin/shot.jpg";

  it("does not treat Activation Photos videos as images", () => {
    expect(
      recapGallerySlot({
        url: mov,
        fileTypeName: "image",
        categoryName: "Activation Photos",
      }),
    ).toBe("video");
  });

  it("still treats neighboring jpgs as images", () => {
    expect(
      recapGallerySlot({
        url: jpg,
        fileTypeName: "image",
        categoryName: "Activation Photos",
      }),
    ).toBe("image");
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

describe("recapDisplayUrl", () => {
  it("rewrites HEIC to the jpg sibling", () => {
    const out = recapDisplayUrl("recaps/bin.heic");
    expect(out.endsWith("recaps/bin.jpg")).toBe(true);
    expect(out.includes(".heic")).toBe(false);
  });
  it("leaves jpeg paths alone", () => {
    const out = recapDisplayUrl("recaps/table.jpg");
    expect(out.endsWith("recaps/table.jpg")).toBe(true);
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

describe("recap video playback urls", () => {
  it("labels mov as mp4 so Chrome will attempt playback", () => {
    expect(recapVideoMime("clip.mov")).toBe("video/mp4");
    expect(recapVideoMime("clip.MP4")).toBe("video/mp4");
    expect(recapVideoMime("clip.webm")).toBe("video/webm");
  });

  it("stores quicktime uploads as video/mp4", () => {
    expect(
      browserPlayableContentType({ type: "video/quicktime", name: "clip.mov" }),
    ).toBe("video/mp4");
    expect(
      browserPlayableContentType({ type: "image/jpeg", name: "table.jpg" }),
    ).toBe("image/jpeg");
  });

  it("does not send Android octet-stream, which upload-url rejects", () => {
    expect(
      browserPlayableContentType({
        type: "application/octet-stream",
        name: "IMG_1234.jpg",
      }),
    ).toBe("image/jpeg");
    expect(
      browserPlayableContentType({
        type: "application/octet-stream",
        name: "table.HEIC",
      }),
    ).toBe("image/heic");
    expect(
      browserPlayableContentType({
        type: "image/heic-sequence",
        name: "burst.heic",
      }),
    ).toBe("image/heic");
    expect(
      browserPlayableContentType({ type: "", name: "shot.png" }),
    ).toBe("image/png");
  });

  it("points play at the inline media endpoint, not a download link", () => {
    const out = recapVideoPlayUrl(
      "https://storage.googleapis.com/sparkio-production/checkin/Activation%20Photos.mov",
      "https://api.example",
    );
    expect(out.startsWith("https://api.example/api/public/media/play?path=")).toBe(
      true,
    );
    expect(decodeURIComponent(out)).toContain("checkin/Activation Photos.mov");
    expect(out.includes("download")).toBe(false);
  });

  it("falls back to the object URL when no API origin is known", () => {
    const raw =
      "https://storage.googleapis.com/sparkio-production/checkin/clip.mp4";
    expect(recapVideoPlayUrl(raw, "")).toBe(raw);
  });
});
