import { describe, it, expect } from "vitest";
import {
  computeUploadProgress,
  formatUploadBytes,
  formatUploadProgress,
} from "./uploadProgress";

const photo = (state: "uploading" | "done" | "failed", size: number) => ({
  state,
  file: { size },
});

describe("computeUploadProgress", () => {
  it("counts only finished uploads, in photos and bytes", () => {
    const progress = computeUploadProgress([
      photo("done", 300),
      photo("done", 100),
      photo("uploading", 600),
      photo("failed", 1000),
    ]);
    expect(progress).toMatchObject({
      totalCount: 4,
      doneCount: 2,
      uploadingCount: 1,
      totalBytes: 2000,
      doneBytes: 400,
      percent: 20,
    });
  });

  it("reaches 100 only when every byte has landed", () => {
    expect(computeUploadProgress([photo("done", 10), photo("done", 0)]).percent).toBe(100);
    expect(computeUploadProgress([photo("done", 10), photo("uploading", 10)]).percent).toBe(50);
  });

  it("falls back to photo count when sizes are unknown, and handles empty", () => {
    expect(computeUploadProgress([photo("done", 0), photo("uploading", 0)]).percent).toBe(50);
    expect(computeUploadProgress([])).toMatchObject({ percent: 0, totalCount: 0 });
  });
});

describe("formatUploadProgress", () => {
  it("shows count, percent, and completed bytes", () => {
    const text = formatUploadProgress(
      computeUploadProgress([photo("done", 1_200_000), photo("uploading", 1_600_000)]),
    );
    expect(text).toBe("Uploading photos… 1 of 2 done · 42% (1.2 MB of 2.8 MB)");
    expect(formatUploadBytes(500)).toBe("1 KB");
  });
});
