import { describe, expect, it } from "vitest";
import {
  isTorchRequestForm,
  TORCH_REQUEST_FORM_SLUG,
} from "./torchRequestForm";

describe("isTorchRequestForm", () => {
  it("matches the live Torch public-form slug", () => {
    expect(TORCH_REQUEST_FORM_SLUG).toBe("keee-torch-thc");
    expect(isTorchRequestForm("keee-torch-thc")).toBe(true);
  });

  it("does not match Liquid Death or Feel Free slugs", () => {
    expect(isTorchRequestForm("ld")).toBe(false);
    expect(isTorchRequestForm("ighn-liquid-death")).toBe(false);
    expect(isTorchRequestForm("feel-free")).toBe(false);
    expect(isTorchRequestForm("girl-beer")).toBe(false);
    expect(isTorchRequestForm("")).toBe(false);
    expect(isTorchRequestForm(null)).toBe(false);
  });
});
