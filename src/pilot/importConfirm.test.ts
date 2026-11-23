import { describe, expect, it } from "vitest";
import {
  confirmedColumnMap,
  parseColumnGuessPayload,
  setGuessField,
  setGuessIncluded,
  storeMatchFromNormalized,
} from "./importConfirm";

describe("column guesses", () => {
  const payload = JSON.stringify({
    fields: [
      { key: "visit_date", label: "Visit date" },
      { key: "notes", label: "Notes" },
    ],
    guesses: [
      {
        header: "Date",
        field: "visit_date",
        field_label: "Visit date",
        reason: "Header matches “date”.",
        source: "rules",
        applied: true,
      },
      {
        header: "Mystery Col",
        field: "notes",
        field_label: "Notes",
        reason: "Suggested from the header wording.",
        source: "model",
        applied: false,
      },
    ],
  });

  it("leaves a model suggestion out of the map until it is turned on", () => {
    const { guesses } = parseColumnGuessPayload(payload);
    expect(confirmedColumnMap(guesses)).toEqual({ visit_date: "Date" });
    const included = setGuessIncluded(guesses, "Mystery Col", true);
    expect(confirmedColumnMap(included)).toEqual({
      visit_date: "Date",
      notes: "Mystery Col",
    });
  });

  it("drops a column when the field is cleared", () => {
    const { guesses, fields } = parseColumnGuessPayload(payload);
    const cleared = setGuessField(guesses, "Date", "", fields);
    expect(confirmedColumnMap(cleared)).toEqual({});
  });

  it("keeps the first header when two included rows share a field", () => {
    const { guesses, fields } = parseColumnGuessPayload(payload);
    const both = setGuessField(
      setGuessIncluded(guesses, "Mystery Col", true),
      "Mystery Col",
      "visit_date",
      fields,
    );
    expect(confirmedColumnMap(both)).toEqual({ visit_date: "Date" });
  });
});

describe("ambiguous store match", () => {
  it("reads candidate reasons and does not invent a chosen store", () => {
    const match = storeMatchFromNormalized(
      JSON.stringify({
        store: null,
        store_match: {
          needs_confirm: true,
          reason: "Nothing is matched until you choose.",
          ai_reason: "Two stores share this banner.",
          candidates: [
            {
              id: 4,
              name: "FreshMart",
              city: "Austin",
              state: "TX",
              reason: "FreshMart (Austin, TX) shares this banner.",
            },
          ],
        },
      }),
    );
    expect(match?.aiReason).toBe("Two stores share this banner.");
    expect(match?.candidates).toHaveLength(1);
    expect(match?.candidates[0]?.city).toBe("Austin");
    expect(match && "retailerId" in match).toBe(false);
  });
});
