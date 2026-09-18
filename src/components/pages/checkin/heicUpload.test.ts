import { describe, it, expect } from "vitest";
import { coerceHeicFile, fileLooksLikeHeic, isHeicUpload } from "./heicUpload";

describe("isHeicUpload", () => {
  it("detects image/heic and image/heif MIME types", () => {
    expect(isHeicUpload({ name: "IMG_1.JPG", type: "image/heic" })).toBe(true);
    expect(isHeicUpload({ name: "shot", type: "image/heif" })).toBe(true);
  });

  it("detects .heic / .heif extensions when MIME is empty or generic", () => {
    expect(isHeicUpload({ name: "IMG_1234.HEIC", type: "" })).toBe(true);
    expect(isHeicUpload({ name: "photo.heif", type: "application/octet-stream" })).toBe(
      true,
    );
  });

  it("leaves JPEG / PNG for canvas downscale (not HEIC decode)", () => {
    expect(isHeicUpload({ name: "table.jpg", type: "image/jpeg" })).toBe(false);
    expect(isHeicUpload({ name: "crowd.png", type: "image/png" })).toBe(false);
  });

  it("treats HEIC sequences and octet-stream .heic as HEIC", () => {
    expect(isHeicUpload({ name: "burst.heics", type: "image/heic-sequence" })).toBe(true);
    expect(isHeicUpload({ name: "shot", type: "image/heif-sequence" })).toBe(true);
  });
});

function heicBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  bytes.set([0x68, 0x65, 0x69, 0x63], 8);
  return bytes;
}

describe("coerceHeicFile", () => {
  it("recognizes ftypheic even when Android says octet-stream", async () => {
    const file = new File([heicBytes()], "image", { type: "application/octet-stream" });
    expect(await fileLooksLikeHeic(file)).toBe(true);
    const coerced = await coerceHeicFile(file);
    expect(coerced.type).toBe("image/heic");
    expect(coerced.name.endsWith(".heic")).toBe(true);
  });

  it("does not rename a real JPEG", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "table.jpg", {
      type: "image/jpeg",
    });
    expect(await coerceHeicFile(file)).toBe(file);
  });
});
