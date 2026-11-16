import { describe, expect, it } from "vitest";
import {
  acceptBlocker,
  acceptSummary,
  chosenAliases,
  kindLabel,
  nameKey,
  plural,
  recordsAffected,
  sourceLabel,
  type StoreNameGroup,
} from "./storeNames";

const group = (over: Partial<StoreNameGroup> = {}): StoreNameGroup => ({
  groupKey: "g1",
  canonicalName: "HEB",
  kind: "chain",
  source: "rule",
  reason: "",
  canonicalRecords: 40,
  affectedRecords: 15,
  names: [
    { uuid: "a", name: "H-E-B", records: 12, places: "Austin, TX" },
    { uuid: "b", name: "H.E.B.", records: 3, places: "" },
  ],
  ...over,
});

const none = new Set<string>();

describe("store name helpers", () => {
  it("counts the records an accept would re-label", () => {
    expect(recordsAffected(group(), none, "HEB")).toBe(15);
    expect(recordsAffected(group(), none, "")).toBe(15);
    expect(recordsAffected(group(), new Set(["b"]), "HEB")).toBe(12);
  });

  it("counts the first suggestion's records when another spelling is kept", () => {
    // Keeping "H-E-B": its own 12 stay, the 40 under "HEB" and 3 under "H.E.B." move.
    expect(recordsAffected(group(), none, " h-e-b ")).toBe(43);
    // A name nobody suggested: all three spellings move.
    expect(recordsAffected(group(), none, "H-E-B Grocery")).toBe(55);
  });

  it("only sends the ticked names", () => {
    expect(chosenAliases(group(), new Set(["a"])).map((n) => n.uuid)).toEqual(["b"]);
  });

  it("blocks an accept with nothing ticked, no name, or too many names", () => {
    expect(acceptBlocker(group(), new Set(["a", "b"]), "HEB", 8)).toBe("Tick at least one name.");
    expect(acceptBlocker(group({ canonicalName: "" }), none, "  ", 8)).toBe(
      "Enter the name to keep.",
    );
    const big = group({
      names: Array.from({ length: 8 }, (_, i) => ({
        uuid: `n${i}`,
        name: `Name ${i}`,
        records: 1,
        places: "",
      })),
    });
    expect(acceptBlocker(big, none, "HEB", 8)).toMatch(/at most 8 names/);
    expect(acceptBlocker(big, new Set(["n0"]), "HEB", 8)).toBeNull();
    expect(acceptBlocker(group(), none, "HEB", 8)).toBeNull();
  });

  it("says what an accept does in one plain sentence", () => {
    expect(acceptSummary(group(), none, "HEB")).toBe(
      "15 records will be shown as “HEB” in reports. The records themselves are not changed.",
    );
    expect(acceptSummary(group(), new Set(["a"]), "HEB")).toMatch(/^3 records will/);
    const unused = group({ canonicalRecords: 0, names: [{ uuid: "a", name: "H-E-B", records: 0, places: "" }] });
    expect(acceptSummary(unused, none, "HEB")).toMatch(/^No records use these spellings/);
    const one = group({ names: [{ uuid: "a", name: "H-E-B", records: 1, places: "" }] });
    expect(acceptSummary(one, none, "HEB")).toMatch(/^1 record will/);
  });

  it("labels kinds and sources in plain words", () => {
    expect(kindLabel("store")).toBe("One store");
    expect(kindLabel("chain")).toBe("One chain");
    expect(sourceLabel("ai")).toMatch(/Check it/);
    expect(sourceLabel("rule")).toMatch(/capitals and punctuation/);
    expect(plural(1200, "record")).toBe("1,200 records");
    expect(nameKey("  Total   WINE ")).toBe("total wine");
  });
});
