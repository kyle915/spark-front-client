import { beforeEach, describe, expect, it, vi } from "vitest";
import { isHeicUpload } from "@/components/pages/checkin/heicUpload";

const heic2any = vi.fn();

vi.mock("heic2any", () => ({
  default: (...args: unknown[]) => heic2any(...args),
}));

describe("isHeicUpload", () => {
  it("detects HEIC by mime and extension", () => {
    expect(isHeicUpload({ type: "image/heic", name: "x.jpg" })).toBe(true);
    expect(isHeicUpload({ type: "image/jpeg", name: "x.heic" })).toBe(true);
    expect(isHeicUpload({ type: "image/jpeg", name: "x.jpg" })).toBe(false);
  });
});

describe("prepareImageForUpload", () => {
  beforeEach(() => {
    heic2any.mockReset();
  });

  it("passes PDFs through unchanged", async () => {
    const { prepareImageForUpload } = await import("./compressImageForUpload");
    const pdf = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    await expect(prepareImageForUpload(pdf)).resolves.toBe(pdf);
    expect(heic2any).not.toHaveBeenCalled();
  });

  it("passes small JPEGs through without re-encoding", async () => {
    const { prepareImageForUpload } = await import("./compressImageForUpload");
    const jpeg = new File(["tiny"], "shot.jpg", { type: "image/jpeg" });
    await expect(prepareImageForUpload(jpeg)).resolves.toBe(jpeg);
    expect(heic2any).not.toHaveBeenCalled();
  });

  it("converts HEIC to JPEG via heic2any before upload", async () => {
    const jpegBlob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    heic2any.mockResolvedValue(jpegBlob);

    const { prepareImageForUpload } = await import("./compressImageForUpload");
    const heic = new File(["heic-bytes"], "IMG_1234.HEIC", {
      type: "image/heic",
    });
    const out = await prepareImageForUpload(heic);

    expect(heic2any).toHaveBeenCalledTimes(1);
    expect(out).not.toBe(heic);
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("IMG_1234.jpg");
  });

  it("uses the first frame when heic2any returns an array", async () => {
    const frame = new Blob(["frame0"], { type: "image/jpeg" });
    heic2any.mockResolvedValue([frame, new Blob(["frame1"], { type: "image/jpeg" })]);

    const { prepareImageForUpload } = await import("./compressImageForUpload");
    const heic = new File(["heic"], "burst.heif", { type: "image/heif" });
    const out = await prepareImageForUpload(heic);

    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("burst.jpg");
  });

  it("falls back to the original HEIC when conversion fails", async () => {
    heic2any.mockRejectedValue(new Error("wasm boom"));

    const { prepareImageForUpload } = await import("./compressImageForUpload");
    const heic = new File(["heic"], "fail.heic", { type: "image/heic" });
    await expect(prepareImageForUpload(heic)).resolves.toBe(heic);
  });
});
