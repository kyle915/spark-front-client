import { afterEach, describe, expect, it, vi } from "vitest";
import { once, playArrival } from "./arrivalSweep";

describe("arrival sweep", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs the hand-off only once", () => {
    const go = vi.fn();
    const arrive = once(go);
    arrive();
    arrive();
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the app when there is no page to draw on", async () => {
    vi.stubGlobal("document", undefined);
    const go = vi.fn();
    await playArrival(go);
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the app for reduced motion", async () => {
    vi.stubGlobal("document", {});
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const go = vi.fn();
    await playArrival(go);
    expect(go).toHaveBeenCalledTimes(1);
  });
});
