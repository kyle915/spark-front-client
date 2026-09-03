import { describe, expect, it } from "vitest";
import {
  eventTypeDescription,
  eventTypesUseDescriptorPicker,
} from "./eventTypeDescriptor";

describe("eventTypeDescription", () => {
  it("describes Retail Sampling and Event Activation", () => {
    expect(eventTypeDescription("Retail Sampling")).toContain("gas stations");
    expect(eventTypeDescription("Event Activation")).toContain(
      "music festivals",
    );
    expect(eventTypeDescription("Product Seeding")).toContain("cases");
  });

  it("matches prefixed Liquid Death labels", () => {
    expect(eventTypeDescription("Liquid Death-Retail Sampling")).toContain(
      "retail chains",
    );
    expect(eventTypeDescription("Liquid Death-Event Activation")).toContain(
      "street samplings",
    );
    expect(eventTypeDescription("Liquid Death-Product Seeding")).toContain(
      "Dropping off",
    );
  });

  it("returns null for unrelated program names", () => {
    expect(eventTypeDescription("Event")).toBeNull();
    expect(eventTypeDescription("On-Premise Sampling")).toBeNull();
  });
});

describe("eventTypesUseDescriptorPicker", () => {
  it("is true when any option has copy", () => {
    expect(
      eventTypesUseDescriptorPicker([
        { name: "Retail Sampling" },
        { name: "Something Else" },
      ]),
    ).toBe(true);
  });

  it("is false when no option has copy", () => {
    expect(
      eventTypesUseDescriptorPicker([
        { name: "Event" },
        { name: "On-Premise Sampling" },
      ]),
    ).toBe(false);
  });
});
