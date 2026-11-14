import { describe, expect, it } from "vitest";
import { sheetRows, sheetVerdict, type SheetShift } from "./sheetStaffing";

const shift = (over: Partial<SheetShift> = {}): SheetShift => ({
  uuid: "s-1",
  startText: "11a",
  endText: "2p",
  storeName: "Plano Country Store",
  baName: "Lashanda Beckwith",
  brandName: "Famus Energy",
  sourceLabel: "Famus / Wook / Alcohol Armor Schedule",
  sheetUrl: "https://docs.google.com/spreadsheets/d/x/edit#gid=0&range=A3",
  match: "matched",
  bookedNames: ["Lashanda Beckwith"],
  agrees: true,
  ...over,
});

describe("sheetVerdict", () => {
  it("says whether Spark's booking agrees with the sheet", () => {
    expect(sheetVerdict(shift())).toEqual({ text: "Booked in Spark", flagged: false });
    expect(
      sheetVerdict(shift({ agrees: false, bookedNames: ["Kayla Buis"] })),
    ).toEqual({ text: "Spark has Kayla Buis", flagged: true });
    expect(sheetVerdict(shift({ agrees: false, bookedNames: [] }))).toEqual({
      text: "Nobody booked in Spark",
      flagged: true,
    });
  });

  it("names a row Spark could not place", () => {
    expect(
      sheetVerdict(shift({ match: "no_event", agrees: null, bookedNames: [] })).text,
    ).toBe("No Spark event for this row");
    expect(
      sheetVerdict(shift({ match: "ambiguous", agrees: null, bookedNames: [] })).text,
    ).toBe("Fits more than one Spark event");
  });
});

describe("sheetRows", () => {
  it("puts disagreements first and adds the brand only across brands", () => {
    const rows = sheetRows(
      [
        shift({ uuid: "ok", storeName: "Aldi" }),
        shift({ uuid: "bad", storeName: "Zeta Liquor", agrees: false, bookedNames: [] }),
      ],
      { showBrand: false },
    );
    expect(rows.map((r) => r.key)).toEqual(["bad", "ok"]);
    expect(rows[1].detail).toBe("Lashanda Beckwith · 11a–2p");
    expect(
      sheetRows([shift({ endText: "" })], { showBrand: true })[0].detail,
    ).toBe("Lashanda Beckwith · 11a · Famus Energy");
  });
});
