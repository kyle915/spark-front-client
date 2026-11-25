import { describe, expect, it } from "vitest";
import { clientOptions, defaultClientScope, tenantKey } from "./staffingBoardScope";

const gid = (n: number) => btoa(`TenantType:${n}`);

describe("tenantKey", () => {
  it("reads a bare integer id", () => expect(tenantKey("39")).toBe("39"));
  it("decodes a relay global id", () => expect(tenantKey(gid(39))).toBe("39"));
  it("returns null for empty or junk", () => {
    expect(tenantKey(null)).toBeNull();
    expect(tenantKey("")).toBeNull();
    expect(tenantKey("not-an-id")).toBeNull();
  });
});

describe("defaultClientScope", () => {
  it("starts on the current workspace", () => {
    expect(defaultClientScope(gid(17))).toBe("17");
    expect(defaultClientScope("17")).toBe("17");
  });
  it("falls back to all clients without a workspace", () => {
    expect(defaultClientScope(null)).toBe("");
  });
});

describe("clientOptions", () => {
  const shifts = [
    { tenantId: gid(17), brandName: "Torch" },
    { tenantId: gid(39), brandName: "American Ice" },
    { tenantId: gid(17), brandName: "Torch" },
  ];

  it("lists each client once, by name", () => {
    expect(clientOptions(shifts, { key: null, fallbackName: "" })).toEqual([
      { key: "39", name: "American Ice" },
      { key: "17", name: "Torch" },
    ]);
  });

  it("keeps the current workspace listed in a week with no shifts", () => {
    const opts = clientOptions(shifts, { key: "18", fallbackName: "Resort Beverage" });
    expect(opts.map((o) => o.key)).toContain("18");
    expect(opts.find((o) => o.key === "18")?.name).toBe("Resort Beverage");
  });

  it("prefers the board's own name over the fallback", () => {
    const opts = clientOptions(shifts, { key: "17", fallbackName: "torch-slug" });
    expect(opts.find((o) => o.key === "17")?.name).toBe("Torch");
  });
});
