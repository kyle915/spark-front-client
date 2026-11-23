import { describe, expect, it } from "vitest";
import {
  parseStorePrepKit,
  shelfStatusLabel,
  storePrepKitHasContent,
  storePrepKitShouldStartOpen,
  storePrepKitShowsPinnedRisk,
} from "./storePrepKit";

describe("store prep kit", () => {
  it("parses a public check-in payload", () => {
    const kit = parseStorePrepKit({
      logisticsNotes: "Park in back · Cooler aisle 4",
      lastShelfVisit: {
        eventDate: "2026-11-10",
        productOnShelf: "no",
        priceTagVisible: "unclear",
        storeName: "Sprouts",
      },
      skus: ["Mango", "Lime"],
      resources: [{ label: "BA Guide", kind: "pdf", url: "https://client.example/g.pdf" }],
      stockRisk: { level: "high", reason: "Last visit OOS" },
    });
    expect(kit?.skus).toEqual(["Mango", "Lime"]);
    expect(kit?.stockRisk?.level).toBe("high");
    expect(storePrepKitHasContent(kit)).toBe(true);
  });

  it("labels shelf status", () => {
    expect(shelfStatusLabel("yes")).toBe("On shelf last visit");
    expect(shelfStatusLabel("no")).toBe("Not found last visit");
    expect(shelfStatusLabel("unclear")).toBe("Shelf status unclear");
  });

  it("treats empty kits as hidden", () => {
    expect(storePrepKitHasContent(parseStorePrepKit({}))).toBe(false);
    expect(storePrepKitHasContent(null)).toBe(false);
  });

  it("starts open on watch/high stock risk and pins the risk line", () => {
    const high = parseStorePrepKit({
      stockRisk: { level: "high", reason: "Last visit OOS" },
    });
    const quiet = parseStorePrepKit({
      logisticsNotes: "Park in back",
      stockRisk: { level: "none", reason: "Shelf looked fine" },
    });
    expect(storePrepKitShouldStartOpen(high)).toBe(true);
    expect(storePrepKitShowsPinnedRisk(high)).toBe(true);
    expect(storePrepKitShouldStartOpen(quiet)).toBe(false);
    expect(storePrepKitShowsPinnedRisk(quiet)).toBe(true);
    expect(storePrepKitShouldStartOpen(parseStorePrepKit({ logisticsNotes: "x" }))).toBe(
      false,
    );
  });
});
