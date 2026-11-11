import { describe, expect, it } from "vitest";
import {
  buildSetupSteps,
  setupDismissKey,
  setupProgress,
  showSetupChecklist,
} from "./setupSteps";

const none = {
  hasProducts: false,
  hasRecapTemplate: false,
  hasClientContact: false,
  hasCheckinLink: false,
  hasEvent: false,
  hasRecap: false,
};

describe("setup checklist", () => {
  it("starts with nothing done on a new workspace", () => {
    const p = setupProgress(buildSetupSteps(none));
    expect(p).toEqual({ done: 0, total: 6, complete: false });
  });

  it("counts finished steps", () => {
    const steps = buildSetupSteps({
      ...none,
      hasProducts: true,
      hasEvent: true,
    });
    expect(setupProgress(steps).done).toBe(2);
    expect(steps.find((s) => s.key === "hasProducts")?.done).toBe(true);
  });

  it("is complete only when every step is done", () => {
    const all = {
      hasProducts: true,
      hasRecapTemplate: true,
      hasClientContact: true,
      hasCheckinLink: true,
      hasEvent: true,
      hasRecap: true,
    };
    expect(setupProgress(buildSetupSteps(all)).complete).toBe(true);
    expect(
      setupProgress(buildSetupSteps({ ...all, hasRecap: false })).complete,
    ).toBe(false);
  });

  it("only links steps the app can finish", () => {
    const steps = buildSetupSteps(none);
    expect(steps.find((s) => s.key === "hasCheckinLink")?.to).toBeUndefined();
    expect(steps.find((s) => s.key === "hasRecap")?.to).toBeUndefined();
    expect(steps.find((s) => s.key === "hasProducts")?.to).toBe(
      "/products/products-list",
    );
  });

  it("shows only before the first recap arrives", () => {
    expect(showSetupChecklist(none)).toBe(true);
    expect(showSetupChecklist({ ...none, hasProducts: true })).toBe(true);
    // Live walk-up program: recaps but no products or requests.
    expect(showSetupChecklist({ ...none, hasRecap: true })).toBe(false);
  });

  it("keys the dismissal per workspace", () => {
    expect(setupDismissKey("a")).not.toBe(setupDismissKey("b"));
  });
});
