import { describe, expect, it } from "vitest";
import {
  PHOTO_CHECK_UNAVAILABLE,
  advisoryFromPhotoCheck,
  kindLabel,
  requestPhotoCheck,
  type PhotoCheckResult,
} from "./photoCheck";

const base: PhotoCheckResult = {
  available: true,
  reason: "",
  bucket: "shelf",
  suggestedBucketName: "Before & After Shelf / Stock",
  productVisible: true,
  emptyShelf: false,
  message: "Looks like Before & After Shelf / Stock.",
};

describe("photo check advisory", () => {
  it("names every bucket kind", () => {
    expect(kindLabel("shelf")).toBe("shelf");
    expect(kindLabel("table_setup")).toBe("table setup");
    expect(kindLabel("sampling")).toBe("sampling");
    expect(kindLabel("receipt")).toBe("receipt");
    expect(kindLabel("other")).toBe("other");
  });

  it("warns on an empty shelf and still allows keep", () => {
    const advisory = advisoryFromPhotoCheck(
      { ...base, productVisible: false, emptyShelf: true, message: "Retake it or keep it." },
      "Before & After Shelf / Stock",
    );
    expect(advisory.kind).toBe("warn");
    expect(advisory.message).toContain("keep");
  });

  it("warns when the shot looks like a different bucket", () => {
    const advisory = advisoryFromPhotoCheck(
      { ...base, bucket: "table_setup", suggestedBucketName: "Table Set Up", message: "Retake or keep." },
      "Sampling photos",
    );
    expect(advisory.kind).toBe("warn");
  });

  it("says photo check unavailable when the model cannot run", () => {
    const advisory = advisoryFromPhotoCheck(
      { ...base, available: false, reason: PHOTO_CHECK_UNAVAILABLE, message: PHOTO_CHECK_UNAVAILABLE },
      "Table Set Up",
    );
    expect(advisory).toEqual({ kind: "unavailable", message: PHOTO_CHECK_UNAVAILABLE });
  });

  it("degrades when the check request fails", async () => {
    const result = await requestPhotoCheck({
      origin: "https://api.test",
      code: "BD-AQRACD",
      session: "tok",
      file: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      contentType: "image/jpeg",
      category: "1",
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    expect(result.message).toBe(PHOTO_CHECK_UNAVAILABLE);
    expect(result.available).toBe(false);
  });
});
