import { describe, expect, it } from "vitest";
import {
  isEventActivationRequestType,
  isOnPremiseRequestType,
  isTorchRequestForm,
  torchActivationFieldsComplete,
  torchActivationGraphqlFields,
  torchActivationNoteLines,
  TORCH_REQUEST_FORM_SLUG,
} from "./torchRequestForm";

const empty = {
  accountSpendAmount: "",
  eventAssetsNeeded: "",
  loadInTime: "",
  onsitePoc: "",
  additionalTeamDetails: "",
};

describe("isTorchRequestForm", () => {
  it("matches the live Torch public-form slug", () => {
    expect(TORCH_REQUEST_FORM_SLUG).toBe("keee-torch-thc");
    expect(isTorchRequestForm("keee-torch-thc")).toBe(true);
  });

  it("does not match Liquid Death or Feel Free slugs", () => {
    expect(isTorchRequestForm("ld")).toBe(false);
    expect(isTorchRequestForm("ighn-liquid-death")).toBe(false);
    expect(isTorchRequestForm("feel-free")).toBe(false);
    expect(isTorchRequestForm("girl-beer")).toBe(false);
    expect(isTorchRequestForm("")).toBe(false);
    expect(isTorchRequestForm(null)).toBe(false);
  });
});

describe("Torch request-type extras", () => {
  it("treats On-Premise and On-Premise Sampling as the same picker value", () => {
    expect(isOnPremiseRequestType("On-Premise")).toBe(true);
    expect(isOnPremiseRequestType("On-Premise Sampling")).toBe(true);
    expect(isOnPremiseRequestType("Event Activation")).toBe(false);
    expect(isOnPremiseRequestType("Retail Sampling")).toBe(false);
  });

  it("matches Event Activation only", () => {
    expect(isEventActivationRequestType("Event Activation")).toBe(true);
    expect(isEventActivationRequestType("On-Premise")).toBe(false);
    expect(isEventActivationRequestType("Retail Sampling")).toBe(false);
  });

  it("requires Account Spend Amount for On-Premise", () => {
    expect(torchActivationFieldsComplete("On-Premise", empty)).toBe(false);
    expect(
      torchActivationFieldsComplete("On-Premise", {
        ...empty,
        accountSpendAmount: " $500 ",
      }),
    ).toBe(true);
    expect(
      torchActivationFieldsComplete("Retail Sampling", empty),
    ).toBe(true);
  });

  it("requires the four Event Activation fields", () => {
    expect(torchActivationFieldsComplete("Event Activation", empty)).toBe(false);
    expect(
      torchActivationFieldsComplete("Event Activation", {
        accountSpendAmount: "",
        eventAssetsNeeded: "10x10",
        loadInTime: "8:00 AM",
        onsitePoc: "Jordan",
        additionalTeamDetails: "Rear lot",
      }),
    ).toBe(true);
  });

  it("appends On-Premise spend to notes and GraphQL", () => {
    const values = { ...empty, accountSpendAmount: " $1,200 " };
    expect(torchActivationNoteLines("On-Premise", values)).toEqual([
      "Account Spend Amount: $1,200",
    ]);
    expect(torchActivationGraphqlFields("On-Premise", values)).toEqual({
      accountSpendAmount: "$1,200",
    });
    expect(torchActivationGraphqlFields("Retail Sampling", values)).toEqual({});
  });

  it("appends Event Activation answers to notes and GraphQL", () => {
    const values = {
      accountSpendAmount: "999",
      eventAssetsNeeded: "10x10, Barrel Cooler",
      loadInTime: "8:00 AM",
      onsitePoc: "Jordan Lee",
      additionalTeamDetails: "Park in the rear lot",
    };
    expect(torchActivationNoteLines("Event Activation", values)).toEqual([
      "What assets are needed at this event?: 10x10, Barrel Cooler",
      "What time is Load-In: 8:00 AM",
      "Who is the onsite POC: Jordan Lee",
      "Any additional details for the team to know?: Park in the rear lot",
    ]);
    expect(torchActivationGraphqlFields("Event Activation", values)).toEqual({
      eventAssetsNeeded: "10x10, Barrel Cooler",
      loadInTime: "8:00 AM",
      onsitePoc: "Jordan Lee",
      additionalTeamDetails: "Park in the rear lot",
    });
  });
});
