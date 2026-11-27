import { describe, expect, it } from "vitest";
import {
  isLiquidDeathBrand,
  trainingHubLogoSrc,
  trainingHubTheme,
} from "./TrainingHub";

describe("training hub tenant skin", () => {
  it("keeps the Liquid Death cream/blood/Bungee look for Liquid Death", () => {
    expect(isLiquidDeathBrand("Liquid Death")).toBe(true);
    const theme = trainingHubTheme("Liquid Death");
    expect(theme.isLiquidDeath).toBe(true);
    expect(theme.bg).toBe("#0A0A0A");
    expect(theme.text).toBe("#F4EFE3");
    expect(theme.accent).toBe("#D9251D");
    expect(theme.displayFont).toContain("Bungee");
  });

  it("uses light Spark studio paper + Space Grotesk for other brands", () => {
    const theme = trainingHubTheme("Torch THC");
    expect(theme.isLiquidDeath).toBe(false);
    expect(theme.bg).toBe("#f6f6f2");
    expect(theme.cardBg).toBe("#ffffff");
    expect(theme.accent).toBe("#14160f");
    expect(theme.displayFont).toContain("Space Grotesk");
    expect(theme.text).toBe("#14160f");
  });

  it("resolves a tenant logo through the shared candidates, null when unknown", () => {
    expect(trainingHubLogoSrc("Torch THC")).toContain("TorchLogo");
    expect(trainingHubLogoSrc("Some Unknown Brand")).toBeNull();
    expect(trainingHubTheme("")).toMatchObject({ isLiquidDeath: false });
  });
});
