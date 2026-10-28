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

  it("uses neutral Spark dark + lime + Space Grotesk for other brands", () => {
    const theme = trainingHubTheme("Torch THC");
    expect(theme.isLiquidDeath).toBe(false);
    expect(theme.bg).toBe("#0A0B0D");
    expect(theme.accent).toBe("#f2f3ee");
    expect(theme.displayFont).toContain("Space Grotesk");
    expect(theme.text).not.toBe("#F4EFE3");
  });

  it("resolves a tenant logo through the shared candidates, null when unknown", () => {
    expect(trainingHubLogoSrc("Torch THC")).toContain("TorchLogo");
    expect(trainingHubLogoSrc("Some Unknown Brand")).toBeNull();
    expect(trainingHubTheme("")).toMatchObject({ isLiquidDeath: false });
  });
});
