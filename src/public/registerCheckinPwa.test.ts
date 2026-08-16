import { describe, expect, it } from "vitest";
import { checkinManifest, isCheckinPath } from "./registerCheckinPwa";

describe("isCheckinPath", () => {
  it("matches public check-in only", () => {
    expect(isCheckinPath("/checkin/FF-YMMK3Q")).toBe(true);
    expect(isCheckinPath("/checkin")).toBe(true);
    expect(isCheckinPath("/spark-form/ld")).toBe(false);
    expect(isCheckinPath("/r/tok")).toBe(false);
    expect(isCheckinPath("/login")).toBe(false);
    expect(isCheckinPath("/")).toBe(false);
  });
});

describe("checkinManifest", () => {
  it("scopes the PWA to /checkin and starts on the live code", () => {
    const m = checkinManifest("/checkin/FF-YMMK3Q");
    expect(m.scope).toBe("/checkin/");
    expect(m.start_url).toBe("/checkin/FF-YMMK3Q");
    expect(m.display).toBe("standalone");
    const icons = m.icons as { src: string }[];
    expect(icons.some((i) => i.src === "/legal/spark-logo.png")).toBe(true);
    expect(icons.some((i) => i.src === "/legal/ignite-square-orange.png")).toBe(true);
  });
});
