import { describe, it, expect } from "vitest";
import { createLimiter } from "./uploadLimiter";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createLimiter", () => {
  it("never runs more than the limit, across separate callers", async () => {
    const run = createLimiter(3);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    };
    // Three "batches" (two picks + a Retry) of 5 each.
    await Promise.all([
      ...Array.from({ length: 5 }, () => run(task)),
      ...Array.from({ length: 5 }, () => run(task)),
      ...Array.from({ length: 5 }, () => run(task)),
    ]);
    expect(peak).toBe(3);
  });

  it("frees the slot when a task throws", async () => {
    const run = createLimiter(1);
    await expect(run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(run(async () => "ok")).resolves.toBe("ok");
  });
});
