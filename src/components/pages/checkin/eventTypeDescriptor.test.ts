import { describe, expect, it } from "vitest";
import {
  eventTypeDescription,
  eventTypeIsActivation,
  eventTypeSkipsIdentifyLocation,
  eventTypesUseDescriptorPicker,
} from "./eventTypeDescriptor";

describe("eventTypeIsActivation", () => {
  it("is true only for Event Activation programs", () => {
    expect(eventTypeIsActivation("Event Activation")).toBe(true);
    expect(eventTypeIsActivation("Torch THC-Event Activation")).toBe(true);
    expect(eventTypeIsActivation("Retail Sampling")).toBe(false);
    expect(eventTypeIsActivation("On-Premise")).toBe(false);
    expect(eventTypeIsActivation(undefined)).toBe(false);
  });
});

describe("eventTypeDescription", () => {
  it("describes Retail, On-Premise, Event, and Product Seeding", () => {
    expect(eventTypeDescription("Retail Sampling")).toContain("gas stations");
    expect(eventTypeDescription("On-Premise")).toContain("Bar or venue");
    expect(eventTypeDescription("On-Premise Sampling")).toContain(
      "Bar or venue",
    );
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

  it("keeps a roaming brand's street sampling under Retail Sampling", () => {
    const retail = eventTypeDescription("Retail Sampling", { roaming: true });
    const activation = eventTypeDescription("Event Activation", { roaming: true });
    expect(retail).toContain("market shift");
    expect(activation).toContain("single venue");
    expect(activation).not.toContain("street");
    expect(eventTypeDescription("Product Seeding", { roaming: true })).toContain("cases");
  });

  it("returns null for unrelated program names", () => {
    expect(eventTypeDescription("Event")).toBeNull();
    expect(eventTypeDescription("Demo Table")).toBeNull();
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
    expect(
      eventTypesUseDescriptorPicker([
        { name: "On-Premise" },
        { name: "Something Else" },
      ]),
    ).toBe(true);
  });

  it("is false when no option has copy", () => {
    expect(
      eventTypesUseDescriptorPicker([
        { name: "Event" },
        { name: "Demo Table" },
      ]),
    ).toBe(false);
  });
});

describe("eventTypeSkipsIdentifyLocation", () => {
  it("skips only Product Seeding", () => {
    expect(eventTypeSkipsIdentifyLocation("Product Seeding")).toBe(true);
    expect(eventTypeSkipsIdentifyLocation("Liquid Death-Product Seeding")).toBe(
      true,
    );
    expect(eventTypeSkipsIdentifyLocation("Retail Sampling")).toBe(false);
    expect(eventTypeSkipsIdentifyLocation("On-Premise")).toBe(false);
    expect(eventTypeSkipsIdentifyLocation("Event Activation")).toBe(false);
  });
});
