import { describe, it, expect } from "vitest";
import {
  classifyPhotoQuality,
  grayFromRgba,
  laplacianVariance,
  meanLuminance,
  qualityMessage,
  quickPhotoHash,
} from "./photoQuality";

describe("photo quality stats", () => {
  it("reads near-black pixels as very dark", () => {
    const gray = grayFromRgba(new Uint8ClampedArray([2, 2, 2, 255, 4, 4, 4, 255]));
    expect(meanLuminance(gray)).toBeLessThan(16);
    expect(classifyPhotoQuality({ mean: meanLuminance(gray), blur: 100 })).toBe("dark");
  });

  it("does not flag a normal bright, detailed photo", () => {
    expect(classifyPhotoQuality({ mean: 140, blur: 500 })).toBeNull();
  });

  it("flags a flat, edgeless frame as blurry but tolerates soft detail", () => {
    const flat = new Array(48 * 48).fill(120);
    expect(laplacianVariance(flat, 48)).toBeLessThan(6);
    expect(classifyPhotoQuality({ mean: 120, blur: laplacianVariance(flat, 48) })).toBe("blurry");
    expect(classifyPhotoQuality({ mean: 120, blur: 40 })).toBeNull();
  });

  it("gives every warning kind BA-facing copy", () => {
    expect(qualityMessage("dark")).toContain("dark");
    expect(qualityMessage("blurry")).toContain("blurry");
    expect(qualityMessage("duplicate")).toContain("exact copy");
  });
});

describe("quickPhotoHash", () => {
  it("matches exact copies and separates different bytes", async () => {
    const bytes = new Uint8Array(20000).map((_, i) => i % 251);
    const a = new File([bytes], "a.jpg", { type: "image/jpeg" });
    const copy = new File([bytes], "copy.jpg", { type: "image/jpeg" });
    const other = new File([new Uint8Array(20000).fill(9)], "b.jpg", { type: "image/jpeg" });
    expect(await quickPhotoHash(copy)).toBe(await quickPhotoHash(a));
    expect(await quickPhotoHash(other)).not.toBe(await quickPhotoHash(a));
  });
});
