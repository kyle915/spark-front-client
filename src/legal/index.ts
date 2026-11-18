import type { LegalDocument } from "./types";
import { termsOfService } from "./termsOfService";
import { privacyPolicy } from "./privacyPolicy";
import { acceptableUsePolicy } from "./acceptableUse";
import { dataProcessingSummary } from "./dataProcessing";

export { termsOfService, privacyPolicy, acceptableUsePolicy, dataProcessingSummary };

/** Order used by the cross-document nav and the export script. */
export const LEGAL_DOCUMENTS: LegalDocument[] = [
  termsOfService,
  privacyPolicy,
  acceptableUsePolicy,
  dataProcessingSummary,
];

/** Linked from every legal page; lives in src/utils/IndependentContractorAgreement.tsx. */
export const CONTRACTOR_AGREEMENT_LINK = {
  label: "Contractor agreement",
  path: "/independent-contractor-agreement",
};
