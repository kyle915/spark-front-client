import { describe, expect, it } from "vitest";
import {
  bucketsToPayload,
  normalizeBucketsFromConfig,
  programIdsForSave,
  resourcesFromApi,
  resourcesToInput,
} from "./standingCheckinHelpers";

describe("standingCheckinStudio helpers", () => {
  it("normalizes flat and program-keyed bucket configs", () => {
    const flat = normalizeBucketsFromConfig([
      { name: "Table Set Up", helper: "wide", min: 2 },
    ]);
    expect(flat.mode).toBe("flat");
    expect(flat.flat[0]).toEqual({
      name: "Table Set Up",
      helper: "wide",
      min: "2",
    });

    const mapped = normalizeBucketsFromConfig({
      "Retail Sampling": [{ name: "Table Set Up" }],
      "Event Activation": [{ name: "Activation Photos", min: 3 }],
    });
    expect(mapped.mode).toBe("byProgram");
    expect(mapped.byProgram["Event Activation"][0].min).toBe("3");
  });

  it("serializes buckets back for the mutation", () => {
    expect(
      bucketsToPayload(
        "flat",
        [
          { name: "Table Set Up", helper: "", min: "" },
          { name: "  ", helper: "", min: "" },
        ],
        {},
      ),
    ).toEqual([{ name: "Table Set Up" }]);

    expect(
      bucketsToPayload(
        "byProgram",
        [],
        {
          Retail: [{ name: "Shelf", helper: "clear", min: "2" }],
          Empty: [{ name: " ", helper: "", min: "" }],
        },
      ),
    ).toEqual({
      Retail: [{ name: "Shelf", helper: "clear", min: 2 }],
    });
  });

  it("filters incomplete resources and keeps kind", () => {
    const rows = resourcesFromApi([
      { label: "Guide", kind: "pdf", url: "/training/g.pdf", note: "23" },
    ]);
    expect(rows[0].kind).toBe("pdf");
    expect(rows[0].hideOnRecapOnly).toBe(false);
    expect(
      resourcesToInput([
        {
          label: "Guide",
          kind: "pdf",
          url: "/training/g.pdf",
          note: "23",
          hideOnRecapOnly: false,
        },
        {
          label: "",
          kind: "link",
          url: "https://x",
          note: "",
          hideOnRecapOnly: false,
        },
      ]),
    ).toEqual([
      {
        label: "Guide",
        url: "/training/g.pdf",
        kind: "pdf",
        note: "23",
        hideOnRecapOnly: false,
      },
    ]);
  });

  it("preserves hideOnRecapOnly through form state and mutation input", () => {
    const fromApi = resourcesFromApi([
      {
        label: "Sampling Guide",
        kind: "pdf",
        url: "/training/torch/guide.pdf",
        note: null,
        hideOnRecapOnly: true,
      },
    ]);
    expect(fromApi[0].hideOnRecapOnly).toBe(true);
    expect(resourcesToInput(fromApi)).toEqual([
      {
        label: "Sampling Guide",
        url: "/training/torch/guide.pdf",
        kind: "pdf",
        note: null,
        hideOnRecapOnly: true,
      },
    ]);
  });

  it("puts the default program first when saving ids", () => {
    expect(programIdsForSave(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(programIdsForSave(["a", "b"], null)).toEqual(["a", "b"]);
    expect(programIdsForSave([], "a")).toEqual([]);
  });
});
