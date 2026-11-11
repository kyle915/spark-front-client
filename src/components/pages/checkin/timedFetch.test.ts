import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./timedFetch";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aborts a request that stalls, so it fails like a dead connection", async () => {
    const stalled = (_: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    const p = withTimeout(stalled, 1000)("https://x.test");
    const caught = p.catch((e: Error) => e.name);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await caught).toBe("AbortError");
  });

  it("passes a fast response straight through", async () => {
    const ok = { ok: true } as Response;
    const res = await withTimeout(async () => ok, 1000)("https://x.test");
    expect(res).toBe(ok);
  });
});
