import type { LegalDocument } from "./types";
import {
  LEGAL_COMPANY,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_PLATFORM,
} from "./common";

export const dataProcessingSummary: LegalDocument = {
  slug: "data-processing",
  title: "Data Processing Summary",
  navLabel: "Data processing",
  path: "/data-processing",
  company: LEGAL_COMPANY,
  platform: LEGAL_PLATFORM,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_EFFECTIVE_DATE,
  intro: [
    "This summary explains how Ignite handles personal information in Client Data when it provides Spark by Ignite and related services to Clients. It is part of the [Terms of Service](/terms-of-service). A full data processing agreement is available on request at " +
      LEGAL_EMAIL +
      "; if the Client and Ignite sign one, it replaces this summary.",
  ],
  parts: [
    {
      id: "dps",
      label: "",
      title: "",
      sections: [
        {
          id: "roles",
          number: "1",
          title: "Roles",
          body: [
            {
              list: [
                "Client Data: the Client decides why personal information in its Client Data is processed. Ignite processes it on the Client's behalf as a service provider (under the California Consumer Privacy Act) and processor (under other state privacy laws).",
                "Ambassador Personal Information, Authorized User account data, and Usage Data: Ignite is an independent business or controller, as described in the [Privacy Policy](/privacy-policy).",
              ],
            },
          ],
        },
        {
          id: "details",
          number: "2",
          title: "Processing details",
          body: [
            {
              list: [
                "Subject matter and purpose: providing the Platform and field marketing services described in the Client's Order, including scheduling, recaps, reporting, AI Features, and support.",
                "Duration: the term of the Client's agreement plus the export and deletion periods in Section 27.3 of the Terms.",
                "People whose data is involved: the Client's Authorized Users, consumers who interact with the Client's programs, and retail or venue contacts the Client provides.",
                "Types of data: names and contact details, consumer comments and feedback, event photos that may show people, sign-up information the Client's program collects, and related program records.",
              ],
            },
          ],
        },
        {
          id: "ignite-commitments",
          number: "3",
          title: "Ignite's commitments",
          body: [
            "For personal information in Client Data, Ignite will:",
            {
              list: [
                "process it only to provide the services, on the Client's documented instructions (including the Terms and the Order), or as required by law;",
                "not sell or share it, not use it for its own commercial purposes outside the business relationship with the Client, and not combine it with personal information from other sources except as permitted by law;",
                "ensure its personnel and contractors who access it are bound by confidentiality obligations;",
                "maintain reasonable administrative, technical, and physical safeguards appropriate to the nature of the data;",
                "use only subprocessors bound by written obligations at least as protective as these, remain responsible for them, and keep a current list in the [Privacy Policy](/privacy-policy#service-providers); the Client may object to a new subprocessor on reasonable data-protection grounds, and the parties will work in good faith to resolve the objection;",
                "notify the Client without undue delay, and in any event within seventy-two (72) hours, after confirming a security incident that compromises the Client's Client Data, and provide the information reasonably needed for the Client to meet its notification obligations;",
                "reasonably assist the Client in responding to individuals' privacy requests and with any required data protection assessments, taking into account the nature of the processing;",
                "on request, provide information reasonably necessary to demonstrate compliance, such as answers to a security questionnaire, no more than once a year unless required by law or following an incident; and",
                "at the end of the services, make Client Data available for export and then delete it as described in Section 27.3 of the Terms, unless the law requires retention.",
              ],
            },
            "Ignite may create and use Aggregated Data that does not identify the Client or any individual, as described in the Terms.",
          ],
        },
        {
          id: "client-commitments",
          number: "4",
          title: "Client's commitments",
          body: [
            {
              list: [
                "Provide any notices and obtain any consents required for Ignite to process personal information in Client Data, including for consumer sign-ups and for any use of event photos in advertising.",
                "Give Ignite only the personal information needed for the services, and no sensitive personal information unless Ignite has agreed in writing.",
                "Make sure its instructions comply with applicable law.",
              ],
            },
          ],
        },
        {
          id: "ai",
          number: "5",
          title: "AI providers",
          body: [
            "AI Features use third-party AI model providers (currently OpenAI) as subprocessors. Ignite sends them only the data needed for each feature, uses their business API services, and does not permit them to use Client Data to train their models under the terms that apply to those services. If a Client user connects an outside AI application through the Spark MCP connection, data the user retrieves is sent to that application at the Client's direction and is not processed by Ignite's subprocessors.",
          ],
        },
        {
          id: "location",
          number: "6",
          title: "Where data is processed",
          body: [
            "Ignite and its subprocessors process Client Data in the United States.",
          ],
        },
        {
          id: "precedence",
          number: "7",
          title: "Precedence",
          body: [
            "If this summary conflicts with the Terms on a data protection matter, this summary controls. A signed data processing agreement controls over both.",
          ],
        },
      ],
    },
  ],
};
