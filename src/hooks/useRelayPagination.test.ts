import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useRelayPagination.ts"),
  "utf8",
);

describe("request list fetch policy", () => {
  it("paints a return visit from the store and keeps refresh on the network", () => {
    const load = src.slice(src.indexOf("const loadWithTracking"), src.indexOf("const loadPage"));
    expect(load).toContain('fetchPolicy: "store-or-network"');
    expect(load).not.toContain("network-only");

    const refresh = src.slice(src.indexOf("const refresh = useCallback"));
    expect(refresh).toContain('fetchPolicy: "network-only"');
  });
});
