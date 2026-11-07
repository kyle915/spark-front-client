import { describe, expect, it } from "vitest";
import {
  stalledUploadingCount,
  uploadStallMessage,
  UPLOAD_STALL_MS,
} from "./uploadStall";

describe("uploadStall", () => {
  it("counts uploading photos past the stall window", () => {
    const now = 1_000_000;
    const photos = [
      { id: "a", state: "uploading" as const, startedAt: now - UPLOAD_STALL_MS - 1 },
      { id: "b", state: "uploading" as const, startedAt: now - 1_000 },
      { id: "c", state: "done" as const, startedAt: now - 90_000 },
    ];
    expect(stalledUploadingCount(photos, now)).toBe(1);
  });

  it("builds BA-facing stall copy", () => {
    expect(uploadStallMessage(0, 0)).toBeNull();
    expect(uploadStallMessage(2, 1)).toMatch(/2 photos still uploading/);
    expect(uploadStallMessage(2, 1)).toMatch(/1 photo failed/);
  });
});
