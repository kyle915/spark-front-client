import { describe, expect, it } from "vitest";
import {
  buildStoreSignalMailto,
  isOosOrReorderSignal,
  matchesStoreSignal,
  type StoreSignalRow,
} from "./storeSignals";

const sample: StoreSignalRow = {
  recapUuid: "r-1",
  storeKey: "s101",
  storeName: "H-E-B Mueller",
  address: "1801 E 51st St, Austin, TX 78723",
  city: "Austin",
  stateCode: "TX",
  eventDate: "2026-11-22",
  stockoutRisk: "Down to 6 cans of Mango in back",
  reorderOpportunity: "Store manager Mike wants 4 more cases of Mango",
  managerContact: "Store manager Mike",
  managerNote: "Asked distributor rep to stop by Tuesday",
  competitorBrand: "",
  competitorPromo: "",
  rmmEmail: "rmm.tx@brand.test",
  distributorName: "Capitol Wright",
};

describe("storeSignals", () => {
  it("detects OOS / reorder leads and matches stores by key or name+state", () => {
    expect(isOosOrReorderSignal(sample)).toBe(true);
    expect(
      matchesStoreSignal({ key: "s101", name: "Other Name", state: "TX" }, [sample], true),
    ).toBe(true);
    expect(
      matchesStoreSignal({ key: "s999", name: "h-e-b mueller", state: "TX" }, [sample], true),
    ).toBe(true);
    expect(
      matchesStoreSignal({ key: "s999", name: "Unrelated", state: "TX" }, [sample], true),
    ).toBe(false);
  });

  it("builds a pre-addressed RMM / distributor mailto draft with all extracted intelligence", () => {
    const href = buildStoreSignalMailto(sample, "Pivot Energy");
    expect(href.startsWith("mailto:rmm.tx%40brand.test?")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Pivot Energy · Out-of-stock & reorder lead — H-E-B Mueller (Austin, TX)");
    expect(decoded).toContain("Distributor: Capitol Wright");
    expect(decoded).toContain("Down to 6 cans of Mango in back");
    expect(decoded).toContain("Store manager Mike wants 4 more cases of Mango");
  });
});
