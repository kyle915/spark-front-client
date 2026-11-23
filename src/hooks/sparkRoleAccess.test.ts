import { describe, expect, it } from "vitest";
import {
  emailGrantsIgniteAdmin,
  roleGrantsSparkAdminToggle,
} from "./sparkRoleAccess";

describe("emailGrantsIgniteAdmin", () => {
  it("grants Ignite production emails", () => {
    expect(emailGrantsIgniteAdmin("kyle@igniteproductions.co")).toBe(true);
    expect(emailGrantsIgniteAdmin("Ops@IgniteProductions.CO")).toBe(true);
  });

  it("refuses brand / other domains", () => {
    expect(emailGrantsIgniteAdmin("rep@torch.com")).toBe(false);
    expect(emailGrantsIgniteAdmin("admin@example.com")).toBe(false);
    expect(emailGrantsIgniteAdmin(null)).toBe(false);
    expect(emailGrantsIgniteAdmin("")).toBe(false);
  });
});

describe("roleGrantsSparkAdminToggle", () => {
  it("grants only the Spark Admin platform role", () => {
    expect(roleGrantsSparkAdminToggle("Spark Admin")).toBe(true);
    expect(roleGrantsSparkAdminToggle("spark admin")).toBe(true);
    expect(roleGrantsSparkAdminToggle("spark-admin")).toBe(true);
  });

  it("never grants brand Client or substring-admin names", () => {
    expect(roleGrantsSparkAdminToggle("Client")).toBe(false);
    expect(roleGrantsSparkAdminToggle("Ambassador")).toBe(false);
    expect(roleGrantsSparkAdminToggle("Brand Admin")).toBe(false);
    expect(roleGrantsSparkAdminToggle("brand_admin")).toBe(false);
    expect(roleGrantsSparkAdminToggle("admin")).toBe(false);
    expect(roleGrantsSparkAdminToggle(null)).toBe(false);
  });
});
