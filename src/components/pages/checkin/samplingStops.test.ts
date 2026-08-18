import { describe, expect, it } from "vitest";
import {
  isTorchWalkupBrand,
  shouldShowSamplingStopCard,
} from "./samplingStops";

const feelFree = { name: "Feel Free", requestUrlName: "bl00-feel-free" };
const torchForm = { name: "Torch THC", requestUrlName: "keee-torch-thc" };
const torchShort = { name: "Torch", requestUrlName: "torch-thc" };

describe("isTorchWalkupBrand", () => {
  it("matches keee-torch-thc and torch-thc", () => {
    expect(isTorchWalkupBrand(torchForm)).toBe(true);
    expect(isTorchWalkupBrand(torchShort)).toBe(true);
    expect(isTorchWalkupBrand({ name: "Torch THC" })).toBe(true);
  });

  it("does not match Feel Free or Liquid Death", () => {
    expect(isTorchWalkupBrand(feelFree)).toBe(false);
    expect(
      isTorchWalkupBrand({
        name: "Liquid Death",
        requestUrlName: "ighn-liquid-death",
      }),
    ).toBe(false);
  });
});

describe("shouldShowSamplingStopCard", () => {
  it("shows for Feel Free once clocked in on a market shift", () => {
    expect(
      shouldShowSamplingStopCard({
        clockState: "clocked_in",
        locationMode: "market",
        brand: feelFree,
      }),
    ).toBe(true);
  });

  it("hides for Torch even if clocked in", () => {
    expect(
      shouldShowSamplingStopCard({
        clockState: "clocked_in",
        locationMode: "address",
        brand: torchForm,
      }),
    ).toBe(false);
    expect(
      shouldShowSamplingStopCard({
        clockState: "clocked_in",
        locationMode: "market",
        brand: torchShort,
      }),
    ).toBe(false);
  });

  it("hides before clock-in and for store-address tenants", () => {
    expect(
      shouldShowSamplingStopCard({
        clockState: "not_started",
        locationMode: "market",
        brand: feelFree,
      }),
    ).toBe(false);
    expect(
      shouldShowSamplingStopCard({
        clockState: "clocked_in",
        locationMode: "address",
        brand: feelFree,
      }),
    ).toBe(false);
  });
});
