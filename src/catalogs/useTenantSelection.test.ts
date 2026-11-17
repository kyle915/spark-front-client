import { describe, expect, it, vi } from "vitest";

vi.mock("react-relay/hooks", () => ({ useLazyLoadQuery: vi.fn() }));
vi.mock("@api/queries/TenantsQuery", () => ({ TenantsQuery: {} }));

import { initialTenantOption } from "./useTenantSelection";

// Alphabetical, as the hook sorts them.
const options = [
  { value: "VGVuYW50OjE=", label: "Acme Water", uuid: "u-acme" },
  { value: "VGVuYW50OjU=", label: "Liquid Death", uuid: "u-ld" },
  { value: "VGVuYW50Ojk=", label: "Torch", uuid: "u-torch" },
];

describe("initialTenantOption", () => {
  it("opens on the client picked in the sidebar, not the first in the list", () => {
    expect(initialTenantOption(options, { tenantId: "VGVuYW50OjU=" })).toBe("VGVuYW50OjU=");
  });

  it("matches on uuid when the ids are written differently", () => {
    expect(initialTenantOption(options, { tenantId: "5", tenantUuid: "u-torch" })).toBe(
      "VGVuYW50Ojk=",
    );
  });

  it("falls back to the first client when nothing is picked or the pick is not offered", () => {
    expect(initialTenantOption(options)).toBe("VGVuYW50OjE=");
    expect(initialTenantOption(options, { tenantId: "VGVuYW50Ojk5" })).toBe("VGVuYW50OjE=");
    expect(initialTenantOption([], { tenantId: "x" })).toBe("");
  });
});
