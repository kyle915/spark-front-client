/** Public /spark-form slug for Torch THC. */
export const TORCH_REQUEST_FORM_SLUG = "keee-torch-thc";

/** Torch's public request form (and the matching internal tenant). */
export function isTorchRequestForm(slug: string | null | undefined): boolean {
  return (slug ?? "").trim() === TORCH_REQUEST_FORM_SLUG;
}

function normalizeRequestTypeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Existing Torch request-type picker: On-Premise / On-Premise Sampling. */
export function isOnPremiseRequestType(
  name: string | null | undefined,
): boolean {
  const n = normalizeRequestTypeName(name);
  return n === "on-premise" || n === "on-premise sampling";
}

/** Existing Torch request-type picker: Event Activation. */
export function isEventActivationRequestType(
  name: string | null | undefined,
): boolean {
  return normalizeRequestTypeName(name) === "event activation";
}

export type TorchActivationValues = {
  accountSpendAmount: string;
  eventAssetsNeeded: string;
  loadInTime: string;
  onsitePoc: string;
  additionalTeamDetails: string;
};

/** Required Torch extras for the selected request type are filled in. */
export function torchActivationFieldsComplete(
  requestTypeName: string | null | undefined,
  values: TorchActivationValues,
): boolean {
  if (isOnPremiseRequestType(requestTypeName)) {
    return !!values.accountSpendAmount.trim();
  }
  if (isEventActivationRequestType(requestTypeName)) {
    return (
      !!values.eventAssetsNeeded.trim() &&
      !!values.loadInTime.trim() &&
      !!values.onsitePoc.trim() &&
      !!values.additionalTeamDetails.trim()
    );
  }
  return true;
}

/** Append to request notes so the RMM email carries the answers. */
export function torchActivationNoteLines(
  requestTypeName: string | null | undefined,
  values: TorchActivationValues,
): string[] {
  const lines: string[] = [];
  if (isOnPremiseRequestType(requestTypeName) && values.accountSpendAmount.trim()) {
    lines.push(`Account Spend Amount: ${values.accountSpendAmount.trim()}`);
  }
  if (isEventActivationRequestType(requestTypeName)) {
    if (values.eventAssetsNeeded.trim()) {
      lines.push(
        `What assets are needed at this event?: ${values.eventAssetsNeeded.trim()}`,
      );
    }
    if (values.loadInTime.trim()) {
      lines.push(`What time is Load-In: ${values.loadInTime.trim()}`);
    }
    if (values.onsitePoc.trim()) {
      lines.push(`Who is the onsite POC: ${values.onsitePoc.trim()}`);
    }
    if (values.additionalTeamDetails.trim()) {
      lines.push(
        `Any additional details for the team to know?: ${values.additionalTeamDetails.trim()}`,
      );
    }
  }
  return lines;
}

/** GraphQL fields for createRequest / createRequestByUrl. */
export function torchActivationGraphqlFields(
  requestTypeName: string | null | undefined,
  values: TorchActivationValues,
): Partial<{
  accountSpendAmount: string;
  eventAssetsNeeded: string;
  loadInTime: string;
  onsitePoc: string;
  additionalTeamDetails: string;
}> {
  if (isOnPremiseRequestType(requestTypeName)) {
    return { accountSpendAmount: values.accountSpendAmount.trim() };
  }
  if (isEventActivationRequestType(requestTypeName)) {
    return {
      eventAssetsNeeded: values.eventAssetsNeeded.trim(),
      loadInTime: values.loadInTime.trim(),
      onsitePoc: values.onsitePoc.trim(),
      additionalTeamDetails: values.additionalTeamDetails.trim(),
    };
  }
  return {};
}

/**
 * Torch spark-form product picker is a multi-select of SKU cards.
 * Match 5MG / 10MG in the product name (spacing and case ignored).
 * Do not treat 15MG / 25MG / 50MG as 5MG.
 */
const MG_5 = /(?:^|[^0-9])5\s*-?\s*mg\b/i;
const MG_10 = /(?:^|[^0-9])10\s*-?\s*mg\b/i;

export function productNameIs5mg(name: string | null | undefined): boolean {
  return MG_5.test(name ?? "");
}

export function productNameIs10mg(name: string | null | undefined): boolean {
  return MG_10.test(name ?? "");
}

/** True when any selected SKU is a 5MG or 10MG product (not 15MG). */
export function selectedProductsInclude5mgOr10mg(
  productNames: Array<string | null | undefined>,
): boolean {
  return productNames.some(
    (name) => productNameIs5mg(name) || productNameIs10mg(name),
  );
}

export type TorchNonActiveValues = {
  nonActiveProductRequired: string;
  casesToBeShipped: string;
};

/** Notes lines for the 5MG/10MG Non-Active block. Empty when the block is hidden. */
export function torchNonActiveNoteLines(
  show: boolean,
  values: TorchNonActiveValues,
): string[] {
  if (!show) return [];
  const lines: string[] = [];
  if (values.nonActiveProductRequired) {
    lines.push(
      `Is Non-Active Product Required?: ${
        values.nonActiveProductRequired === "yes" ? "Yes" : "No"
      }`,
    );
  }
  const cases = values.casesToBeShipped.trim();
  if (cases) {
    lines.push(`How many cases to be shipped?: ${cases}`);
  }
  return lines;
}

/** GraphQL fields for the 5MG/10MG Non-Active block. Empty when hidden. */
export function torchNonActiveGraphqlFields(
  show: boolean,
  values: TorchNonActiveValues,
): Partial<{
  isNonActiveProductRequired: boolean;
  casesToBeShipped: string;
}> {
  if (!show) return {};
  const fields: {
    isNonActiveProductRequired?: boolean;
    casesToBeShipped?: string;
  } = {};
  if (values.nonActiveProductRequired) {
    fields.isNonActiveProductRequired = values.nonActiveProductRequired === "yes";
  }
  const cases = values.casesToBeShipped.trim();
  if (cases) fields.casesToBeShipped = cases;
  return fields;
}
