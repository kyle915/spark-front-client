import { describe, expect, it } from "vitest";
import {
  decideTenantParamSwitch,
  decideTenantSwitch,
  findSwitchableTenant,
  isSelectedTenant,
  readTenantLinkParam,
  resolveTenantParam,
  stripTenantParam,
  type SwitchableTenant,
} from "./tenantDeepLink";

const LD: SwitchableTenant = {
  id: "VGVuYW50VHlwZTox",
  uuid: "0190aaaa-0000-7000-8000-000000000001",
  name: "Liquid Death",
  tenantSlug: "liquid-death",
};
const BRK: SwitchableTenant = {
  id: "VGVuYW50VHlwZToy",
  uuid: "0190BBBB-0000-7000-8000-000000000002",
  name: "Breakaway",
  tenantSlug: "breakaway",
};
const TORCH: SwitchableTenant = {
  id: "VGVuYW50VHlwZToz",
  uuid: "0190cccc-0000-7000-8000-000000000003",
  name: "Torch",
  tenantSlug: "keee-torch-thc",
};

const inLD = { tenantId: LD.id, tenantUuid: LD.uuid };

describe("decideTenantSwitch", () => {
  it("does nothing when the record is in the selected tenant", () => {
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { id: LD.id, uuid: LD.uuid },
        tenants: [LD, BRK],
      }),
    ).toBeNull();
    // uuid alone is enough to recognise the same tenant
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { uuid: LD.uuid.toUpperCase() },
        tenants: [LD, BRK],
      }),
    ).toBeNull();
  });

  it("switches to the record's tenant when the user can switch to it", () => {
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { id: BRK.id },
        tenants: [LD, BRK],
      }),
    ).toBe(BRK);
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { uuid: BRK.uuid.toLowerCase() },
        tenants: [LD, BRK],
      }),
    ).toBe(BRK);
  });

  it("does nothing when the record's tenant is not in the user's list", () => {
    // A brand user only has their own tenant.
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { id: TORCH.id, uuid: TORCH.uuid },
        tenants: [LD],
      }),
    ).toBeNull();
    expect(
      decideTenantSwitch({
        selected: inLD,
        record: { id: TORCH.id, uuid: TORCH.uuid },
        tenants: [],
      }),
    ).toBeNull();
  });

  it("does nothing for a record with no tenant", () => {
    for (const record of [null, undefined, {}, { id: null, uuid: "" }]) {
      expect(
        decideTenantSwitch({ selected: inLD, record, tenants: [LD, BRK] }),
      ).toBeNull();
    }
  });

  it("picks the record's tenant when nothing is selected yet", () => {
    expect(
      decideTenantSwitch({
        selected: { tenantId: null, tenantUuid: null },
        record: { id: BRK.id },
        tenants: [LD, BRK],
      }),
    ).toBe(BRK);
  });

  it("is stable once switched — no second switch, so no loop", () => {
    const first = decideTenantSwitch({
      selected: inLD,
      record: { id: BRK.id, uuid: BRK.uuid },
      tenants: [LD, BRK],
    });
    expect(first).toBe(BRK);
    expect(
      decideTenantSwitch({
        selected: { tenantId: first!.id, tenantUuid: first!.uuid },
        record: { id: BRK.id, uuid: BRK.uuid },
        tenants: [LD, BRK],
      }),
    ).toBeNull();
  });
});

describe("isSelectedTenant / findSwitchableTenant", () => {
  it("matches global ids exactly and uuids case-insensitively", () => {
    expect(isSelectedTenant({ id: LD.id }, inLD)).toBe(true);
    expect(isSelectedTenant({ id: LD.id.toLowerCase() }, inLD)).toBe(false);
    expect(isSelectedTenant({ uuid: LD.uuid.toUpperCase() }, inLD)).toBe(true);
    expect(isSelectedTenant(null, inLD)).toBe(false);
    expect(isSelectedTenant({ id: "", uuid: "" }, {})).toBe(false);
  });

  it("only ever returns a row from the list", () => {
    expect(findSwitchableTenant({ id: BRK.id }, [LD, BRK])).toBe(BRK);
    expect(findSwitchableTenant({ id: TORCH.id }, [LD, BRK])).toBeNull();
    expect(findSwitchableTenant({}, [LD, BRK])).toBeNull();
  });
});

describe("?t= / ?tenant= links", () => {
  it("reads ?t= first, then legacy ?tenant=", () => {
    expect(readTenantLinkParam("?t=abc")).toBe("abc");
    expect(readTenantLinkParam("?tenant=legacy")).toBe("legacy");
    expect(readTenantLinkParam("?t=short&tenant=legacy")).toBe("short");
    expect(readTenantLinkParam("?activation=retail")).toBeNull();
    expect(readTenantLinkParam("")).toBeNull();
  });

  it("resolves a uuid or a slug, from the user's list only", () => {
    expect(resolveTenantParam(BRK.uuid.toLowerCase(), [LD, BRK])).toBe(BRK);
    expect(resolveTenantParam("Breakaway", [LD, BRK])).toBe(BRK);
    expect(resolveTenantParam(TORCH.uuid, [LD, BRK])).toBeNull();
    expect(resolveTenantParam("keee-torch-thc", [LD, BRK])).toBeNull();
    expect(resolveTenantParam("", [LD, BRK])).toBeNull();
    expect(resolveTenantParam(null, [LD, BRK])).toBeNull();
  });

  it("same tenant → nothing; allowed → switch; not allowed → nothing", () => {
    expect(
      decideTenantParamSwitch({
        selected: inLD,
        param: LD.uuid,
        tenants: [LD, BRK],
      }),
    ).toBeNull();
    expect(
      decideTenantParamSwitch({
        selected: inLD,
        param: BRK.uuid,
        tenants: [LD, BRK],
      }),
    ).toBe(BRK);
    expect(
      decideTenantParamSwitch({
        selected: inLD,
        param: TORCH.uuid,
        tenants: [LD],
      }),
    ).toBeNull();
  });

  it("strips ?t= and legacy ?tenant=", () => {
    expect(stripTenantParam("?t=abc")).toBe("");
    expect(stripTenantParam("?tenant=abc")).toBe("");
    expect(stripTenantParam("?activation=retail&t=abc")).toBe(
      "?activation=retail",
    );
    expect(stripTenantParam("?t=a&tenant=b&activation=retail")).toBe(
      "?activation=retail",
    );
    expect(stripTenantParam("?request=12")).toBe("?request=12");
    expect(stripTenantParam("")).toBe("");
  });
});
