import { describe, it, expect } from "vitest";
import { isHeicUpload } from "./heicUpload";

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

  it("leaves JPEG / PNG on the canvas-compress path", () => {
    expect(isHeicUpload({ name: "table.jpg", type: "image/jpeg" })).toBe(false);
    expect(isHeicUpload({ name: "crowd.png", type: "image/png" })).toBe(false);
  });
});
