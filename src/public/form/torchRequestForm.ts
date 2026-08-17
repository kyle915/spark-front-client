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
