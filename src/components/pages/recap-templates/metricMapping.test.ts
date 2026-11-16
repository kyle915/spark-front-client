import { describe, expect, it } from "vitest";
import {
  applyAllSuggestions,
  applySuggestion,
  changedInputs,
  confirmedNote,
  countedAs,
  draftFromFields,
  draftProblem,
  metricLabel,
  missingStandardNumbers,
  optionAllowed,
  type MappingField,
  type MetricOption,
} from "./metricMapping";

const options: MetricOption[] = [
  { key: "consumers_sampled", label: "Consumers sampled" },
  { key: "units_sold_single", label: "Units sold (singles)" },
  { key: "units_sold_pack", label: "Units sold (packs)" },
  { key: "willing_to_buy", label: "Willing to buy" },
  { key: "not_willing", label: "Not willing to buy" },
  { key: "first_time", label: "First-time consumers" },
  { key: "brand_aware", label: "Knew the brand" },
  { key: "samples_given", label: "Samples given out" },
  { key: "none", label: "Not a standard number" },
];

function field(over: Partial<MappingField> & { fieldId: string; name: string }): MappingField {
  return {
    fieldType: "number",
    section: "Sampling",
    currentMetric: null,
    confirmedMetric: null,
    packSize: null,
    confirmedBy: "",
    confirmedAt: null,
    canCount: true,
    ...over,
  };
}

const tried = field({ fieldId: "1", name: "People who tried it" });
const bottles = field({ fieldId: "2", name: "Bottles moved" });
const cases = field({ fieldId: "3", name: "Cases moved" });
const cans = field({ fieldId: "4", name: "Single Cans", currentMetric: "units_sold_single" });
const notes = field({ fieldId: "5", name: "What did people say?", fieldType: "longtext", canCount: false });
const all = [tried, bottles, cases, cans, notes];

describe("what a field counts as", () => {
  it("goes by wording until a choice is made", () => {
    const draft = draftFromFields(all);
    expect(countedAs(cans, draft["4"])).toBe("units_sold_single");
    expect(countedAs(tried, draft["1"])).toBeNull();
  });

  it("a choice wins over the wording, and 'not a standard number' counts as nothing", () => {
    expect(countedAs(cans, { metric: "none", packSize: "" })).toBeNull();
    expect(countedAs(tried, { metric: "consumers_sampled", packSize: "" })).toBe(
      "consumers_sampled",
    );
  });

  it("labels nothing plainly", () => {
    expect(metricLabel(null, options)).toBe("Nothing");
    expect(metricLabel("none", options)).toBe("Nothing");
    expect(metricLabel("brand_aware", options)).toBe("Knew the brand");
  });
});

describe("missing standard numbers", () => {
  it("lists every number with no field, before the client sees a dash", () => {
    const missing = missingStandardNumbers(all, draftFromFields(all), {
      tracksProductSamples: false,
    });
    expect(missing.map((m) => m.label)).toEqual([
      "Consumers sampled",
      "Willing to buy",
      "First-time consumers",
      "Knew the brand",
      "Samples given out",
    ]);
  });

  it("drops a number from the list as soon as a field is set to it", () => {
    const draft = {
      ...draftFromFields(all),
      "1": { metric: "consumers_sampled", packSize: "" },
    };
    const keys = missingStandardNumbers(all, draft, { tracksProductSamples: false }).map(
      (m) => m.key,
    );
    // Samples fall back to consumers sampled, so they stop being missing too.
    expect(keys).toEqual(["willing_to_buy", "first_time", "brand_aware"]);
  });

  it("adds units sold to the list when its only field is set to nothing", () => {
    const draft = { ...draftFromFields(all), "4": { metric: "none", packSize: "" } };
    const keys = missingStandardNumbers(all, draft, { tracksProductSamples: true }).map(
      (m) => m.key,
    );
    expect(keys).toContain("units_sold");
    expect(keys).not.toContain("samples_given"); // the template tracks product rows
  });
});

describe("suggestions", () => {
  it("are taken into the draft only when a person takes them", () => {
    const draft = draftFromFields(all);
    const next = applySuggestion(draft, cases, {
      fieldId: "3",
      metric: "units_sold_pack",
      packSize: 6,
      reason: "Cases sold.",
    });
    expect(draft["3"]).toEqual({ metric: "", packSize: "" });
    expect(next["3"]).toEqual({ metric: "units_sold_pack", packSize: "6" });
  });

  it("never put a count on a field that does not hold a number", () => {
    const draft = draftFromFields(all);
    expect(optionAllowed(notes, "brand_aware")).toBe(false);
    expect(optionAllowed(notes, "none")).toBe(true);
    const next = applyAllSuggestions(draft, all, [
      { fieldId: "5", metric: "brand_aware", packSize: null, reason: "" },
      { fieldId: "1", metric: "consumers_sampled", packSize: null, reason: "" },
    ]);
    expect(next["5"].metric).toBe("");
    expect(next["1"].metric).toBe("consumers_sampled");
  });
});

describe("saving", () => {
  it("sends only the fields that changed", () => {
    const draft = {
      ...draftFromFields(all),
      "1": { metric: "consumers_sampled", packSize: "" },
      "3": { metric: "units_sold_pack", packSize: "6" },
    };
    expect(changedInputs(all, draft)).toEqual([
      { fieldId: "1", metric: "consumers_sampled", packSize: null },
      { fieldId: "3", metric: "units_sold_pack", packSize: 6 },
    ]);
    expect(changedInputs(all, draftFromFields(all))).toEqual([]);
  });

  it("sends null to set a confirmed field back to its wording", () => {
    const confirmed = field({
      fieldId: "9",
      name: "Single Cans",
      currentMetric: "units_sold_single",
      confirmedMetric: "none",
    });
    const draft = { "9": { metric: "", packSize: "" } };
    expect(changedInputs([confirmed], draft)).toEqual([
      { fieldId: "9", metric: null, packSize: null },
    ]);
  });

  it("sees a changed pack size as a change", () => {
    const confirmed = field({
      fieldId: "3",
      name: "Cases moved",
      confirmedMetric: "units_sold_pack",
      packSize: 6,
    });
    expect(changedInputs([confirmed], draftFromFields([confirmed]))).toEqual([]);
    expect(
      changedInputs([confirmed], { "3": { metric: "units_sold_pack", packSize: "12" } }),
    ).toEqual([{ fieldId: "3", metric: "units_sold_pack", packSize: 12 }]);
  });

  it("stops two fields being the same single number", () => {
    const draft = {
      ...draftFromFields(all),
      "1": { metric: "consumers_sampled", packSize: "" },
      "2": { metric: "consumers_sampled", packSize: "" },
    };
    expect(draftProblem(all, draft, options)).toBe(
      "Only one field can be consumers sampled: “People who tried it” and “Bottles moved” are both set to it.",
    );
  });

  it("lets several fields be units sold, one line per product", () => {
    const draft = {
      ...draftFromFields(all),
      "2": { metric: "units_sold_single", packSize: "" },
      "4": { metric: "units_sold_single", packSize: "" },
      "3": { metric: "units_sold_pack", packSize: "" },
    };
    expect(draftProblem(all, draft, options)).toBeNull();
  });

  it("asks for a sensible pack size", () => {
    const draft = { ...draftFromFields(all), "3": { metric: "units_sold_pack", packSize: "six" } };
    expect(draftProblem(all, draft, options)).toContain("Units per pack");
  });
});

describe("confirmed note", () => {
  it("says who confirmed and when", () => {
    const confirmed = field({
      fieldId: "1",
      name: "People who tried it",
      confirmedMetric: "consumers_sampled",
      confirmedBy: "Sam Lee",
      confirmedAt: "2026-11-15T18:00:00+00:00",
    });
    expect(confirmedNote(confirmed)).toBe("Confirmed by Sam Lee on Nov 15, 2026");
    expect(confirmedNote(tried)).toBe("");
  });
});
