import { describe, expect, it } from "vitest";
import {
  collapseSamplingKpis,
  previousForSamplingTile,
} from "./collapseSamplingKpis";

describe("collapseSamplingKpis", () => {
  it("collapses the 1,060 triplet into one consumers-sampled tile", () => {
    const tiles = collapseSamplingKpis({
      consumersReached: 1060,
      samplesDistributed: 1060,
      totalEngagements: 1060,
    });
    expect(tiles).toEqual([
      { key: "consumersSampled", label: "Consumers sampled", value: 1060 },
    ]);
  });

  it("collapses Girl Beer twins and keeps a distinct engagement count", () => {
    const tiles = collapseSamplingKpis({
      consumersReached: 8171,
      samplesDistributed: 8171,
      totalEngagements: 500,
    });
    expect(tiles).toEqual([
      { key: "consumersSampled", label: "Consumers sampled", value: 8171 },
      { key: "totalEngagements", label: "Total engagements", value: 500 },
    ]);
  });

  it("keeps three tiles when every count is different", () => {
    const tiles = collapseSamplingKpis({
      consumersReached: 100,
      samplesDistributed: 80,
      totalEngagements: 40,
    });
    expect(tiles.map((t) => t.key)).toEqual([
      "consumersSampled",
      "samplesDistributed",
      "totalEngagements",
    ]);
    expect(tiles[1].label).toBe("Samples handed out");
  });

  it("never labels the consumers mirror as samples handed out", () => {
    const tiles = collapseSamplingKpis({
      consumersReached: 152526,
      samplesDistributed: 152526,
      totalEngagements: 90000,
    });
    expect(tiles.map((t) => t.label)).toEqual([
      "Consumers sampled",
      "Total engagements",
    ]);
  });

  it("uses samples as the sampled count when reach is zero", () => {
    const tiles = collapseSamplingKpis({
      consumersReached: 0,
      samplesDistributed: 44,
      totalEngagements: 44,
    });
    expect(tiles).toEqual([
      { key: "consumersSampled", label: "Consumers sampled", value: 44 },
    ]);
  });
});

describe("previousForSamplingTile", () => {
  it("reads the collapsed previous headcount", () => {
    const [tile] = collapseSamplingKpis({
      consumersReached: 300,
      samplesDistributed: 300,
      totalEngagements: 300,
    });
    expect(
      previousForSamplingTile(tile, {
        consumersReached: 200,
        samplesDistributed: 200,
        totalEngagements: 200,
      }),
    ).toBe(200);
  });
});
