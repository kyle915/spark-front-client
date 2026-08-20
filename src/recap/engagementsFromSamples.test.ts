import { describe, expect, it } from "vitest";
import {
  engagementsFromSamplesGiven,
  isConsumersSampledCountField,
  parseCleanCount,
  templateHasConsumersSampledField,
} from "./engagementsFromSamples";

describe("isConsumersSampledCountField", () => {
  it("matches Torch's samples-given question", () => {
    expect(
      isConsumersSampledCountField("Total number of consumers sampled"),
    ).toBe(true);
    expect(
      isConsumersSampledCountField("How many TOTAL consumers did you sample?"),
    ).toBe(true);
    expect(
      isConsumersSampledCountField("How many consumers did you interact with?"),
    ).toBe(true);
  });

  it("skips demographics that only mention consumers sampled", () => {
    expect(
      isConsumersSampledCountField(
        "General demographics of consumers sampled (age range, gender, ethnicity)",
      ),
    ).toBe(false);
  });

  it("does not treat an unrelated number as engagements", () => {
    expect(isConsumersSampledCountField("First time consumers?")).toBe(false);
    expect(isConsumersSampledCountField("How many packs did consumers purchase?")).toBe(
      false,
    );
  });
});

describe("parseCleanCount", () => {
  it("accepts a plain integer", () => {
    expect(parseCleanCount("87")).toBe(87);
    expect(parseCleanCount("1,200")).toBe(1200);
  });

  it("rejects prose so a demographics answer cannot become a KPI", () => {
    expect(parseCleanCount("ranged from 19 to 60s")).toBeNull();
    expect(parseCleanCount("")).toBeNull();
  });
});

describe("engagementsFromSamplesGiven", () => {
  const fields = [
    { id: "a", name: "First time consumers?" },
    { id: "b", name: "Total number of consumers sampled" },
  ];

  it("reads Spark engagements from the samples-given answer", () => {
    expect(engagementsFromSamplesGiven(fields, { a: "61", b: "87" })).toBe(87);
  });

  it("returns null when the samples-given field is blank", () => {
    expect(engagementsFromSamplesGiven(fields, { a: "61", b: "" })).toBeNull();
  });
});

describe("templateHasConsumersSampledField", () => {
  it("is true for the Torch retail template question", () => {
    expect(
      templateHasConsumersSampledField([
        { name: "Total number of consumers sampled" },
      ]),
    ).toBe(true);
  });
});
