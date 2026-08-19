import { describe, expect, it } from "vitest";
import {
  isEventActivationRequestType,
  isOnPremiseRequestType,
  isTorchRequestForm,
  productNameIs10mg,
  productNameIs5mg,
  selectedProductsInclude5mgOr10mg,
  torchActivationFieldsComplete,
  torchActivationGraphqlFields,
  torchActivationNoteLines,
  torchNonActiveGraphqlFields,
  torchNonActiveNoteLines,
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

describe("Torch 5MG / 10MG Non-Active gate", () => {
  it("matches 5mg/10mg in product names without treating 15mg as 5mg", () => {
    expect(productNameIs5mg("Torch 5MG Gummies")).toBe(true);
    expect(productNameIs5mg("5 mg Live Resin")).toBe(true);
    expect(productNameIs5mg("5-MG")).toBe(true);
    expect(productNameIs5mg("15MG Gummies")).toBe(false);
    expect(productNameIs5mg("25MG")).toBe(false);
    expect(productNameIs5mg("Torch 10MG")).toBe(false);

    expect(productNameIs10mg("Torch 10MG Gummies")).toBe(true);
    expect(productNameIs10mg("10 mg")).toBe(true);
    expect(productNameIs10mg("10-MG")).toBe(true);
    expect(productNameIs10mg("110MG")).toBe(false);
    expect(productNameIs10mg("Torch 5MG")).toBe(false);
  });

  it("shows when any selected SKU is 5MG or 10MG, without requiring both families", () => {
    expect(
      selectedProductsInclude5mgOr10mg(["Torch 5MG", "Torch 10MG"]),
    ).toBe(true);
    expect(
      selectedProductsInclude5mgOr10mg([
        "Peach Iced Tea 5mg 4-Pack",
        "Iced Tea Lemonade 5mg 12oz",
      ]),
    ).toBe(true);
    expect(selectedProductsInclude5mgOr10mg(["Torch 5MG"])).toBe(true);
    expect(selectedProductsInclude5mgOr10mg(["Torch 10MG"])).toBe(true);
    expect(
      selectedProductsInclude5mgOr10mg([
        "Torch 5MG Gummies",
        "Torch 10 mg Live Resin",
        "Other SKU",
      ]),
    ).toBe(true);
    expect(selectedProductsInclude5mgOr10mg(["15MG", "25MG"])).toBe(false);
    expect(selectedProductsInclude5mgOr10mg(["Blue Razz 25mg 12oz"])).toBe(
      false,
    );
    expect(selectedProductsInclude5mgOr10mg([])).toBe(false);
  });

  it("omits Non-Active notes and GraphQL when the block is hidden", () => {
    const values = {
      nonActiveProductRequired: "yes",
      casesToBeShipped: "12",
    };
    expect(torchNonActiveNoteLines(false, values)).toEqual([]);
    expect(torchNonActiveGraphqlFields(false, values)).toEqual({});
  });

  it("appends Non-Active answers and optional cases when shown", () => {
    expect(
      torchNonActiveNoteLines(true, {
        nonActiveProductRequired: "no",
        casesToBeShipped: " 4 ",
      }),
    ).toEqual([
      "Is Non-Active Product Required?: No",
      "How many cases to be shipped?: 4",
    ]);
    expect(
      torchNonActiveGraphqlFields(true, {
        nonActiveProductRequired: "yes",
        casesToBeShipped: "4",
      }),
    ).toEqual({
      isNonActiveProductRequired: true,
      casesToBeShipped: "4",
    });
    expect(
      torchNonActiveGraphqlFields(true, {
        nonActiveProductRequired: "no",
        casesToBeShipped: "",
      }),
    ).toEqual({ isNonActiveProductRequired: false });
  });
});
