import LegalDocumentView from "./LegalDocumentView";
import {
  acceptableUsePolicy,
  dataProcessingSummary,
  privacyPolicy,
  termsOfService,
} from "./index";

export const TermsOfServicePage = () => <LegalDocumentView doc={termsOfService} />;
export const PrivacyPolicyPage = () => <LegalDocumentView doc={privacyPolicy} />;
export const AcceptableUsePolicyPage = () => (
  <LegalDocumentView doc={acceptableUsePolicy} />
);
export const DataProcessingPage = () => (
  <LegalDocumentView doc={dataProcessingSummary} />
);
