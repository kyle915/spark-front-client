import type { LegalDocument } from "./types";
import {
  LEGAL_COMPANY,
  LEGAL_CONTACT_LINES,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_PLATFORM,
} from "./common";

/**
 * Service-provider list. Keep it accurate: it is a public commitment.
 * Verified against spark-api / spark-front-client code on 2026-11-17.
 */
export const SERVICE_PROVIDERS: string[][] = [
  ["Google Cloud (Cloud Run, Cloud SQL, Cloud Storage, Cloud Tasks)", "Application hosting, database, file and photo storage, background jobs", "All Platform data"],
  ["Google Firebase Hosting", "Hosting the Spark web app", "Technical data such as IP address and browser details"],
  ["Google Maps Platform", "Address lookup, directions, and time zones", "Store and event addresses; route points for mileage"],
  ["OpenAI", "AI Features: summaries, receipt reading, photo checks, insights, product Q&A", "The recap text, photos, receipts, and program data needed for the feature"],
  ["Wingspan", "Ambassador onboarding for payment, payouts, and tax forms", "Ambassador name, contact details, payment amounts; Wingspan collects bank and tax details directly"],
  ["Quo (formerly OpenPhone)", "Text messages to Ambassadors and support replies", "Name, mobile number, message content"],
  ["Resend", "Transactional email", "Name, email address, message content"],
  ["Expo", "Push notifications to the mobile app", "Device push token, notification content"],
  ["Open-source mapping services (Photon geocoder; OSRM routing)", "Converting addresses and coordinates, and calculating driving distance for mileage", "Addresses and location coordinates, without names"],
];

export const privacyPolicy: LegalDocument = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  navLabel: "Privacy",
  path: "/privacy-policy",
  pdfPath: "/legal/privacy-policy.pdf",
  company: LEGAL_COMPANY,
  platform: LEGAL_PLATFORM,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_EFFECTIVE_DATE,
  intro: [
    'Ignite Productions LLC ("Ignite," "we," "us," or "our"), a Nevada limited liability company and Veteran-Owned Small Business, operates Spark by Ignite ("Spark" or the "Platform"), a field marketing operations and reporting platform. This Privacy Policy explains what personal information we collect through Spark, how we use and share it, and the choices and rights you have.',
    "It applies to the people who use Spark: users at brands and other businesses that run programs on Spark (\"Clients\"), brand ambassadors and other field personnel (\"Ambassadors\"), people who apply for work or check in through our public pages, and consumers whose information is captured at events. Capitalized terms not defined here have the meaning given in our [Terms of Service](/terms-of-service).",
  ],
  parts: [
    {
      id: "privacy",
      label: "",
      title: "",
      sections: [
        {
          id: "roles",
          number: "1",
          title: "Our role",
          body: [
            "For Ambassador information, account information, and information about how the Platform is used, Ignite decides how and why the information is used and is responsible for it (a \"business\" or \"controller\").",
            "For personal information in Client Data (for example, consumer comments or sign-ups a Client asks us to collect), Ignite processes the information on the Client's behalf as its service provider or processor, under the Client's instructions and our [Data Processing Summary](/data-processing). If you have a question about how a brand uses that information, please contact the brand; we will help it respond.",
          ],
        },
        {
          id: "information-we-collect",
          number: "2",
          title: "Information we collect",
          body: [
            { h: "2.1 Client users", id: "collect-clients" },
            {
              list: [
                "Account details: name, work email, phone number, company, role, and sign-in information (including from Google sign-in, if you use it).",
                "Program information you submit: event requests, schedules, store lists, product catalogs, approvals, comments, and files.",
                "Communications with us, and settings such as notification preferences.",
                "If you connect an AI application through the Spark MCP connection: the name of the connected application, when it connected, and a log of the requests it makes (we use this for security, quotas, and support).",
              ],
            },
            { h: "2.2 Ambassadors and applicants", id: "collect-ambassadors" },
            {
              list: [
                "Identity and contact details: first and last name, phone number, email, mailing address, state, market, and profile photo.",
                "Profile and availability: experience, languages, t-shirt size, availability, assignments accepted or declined, and training completed.",
                "Work records: assignments, clock-in and clock-out times, recaps, photos and videos, receipts, product spend, mileage records, approvals, ratings, and notes from Ignite or Clients about performance.",
                "Precise location: described in Section 3.",
                "Payment and tax information: Ignite records activation fees, approved hours, reimbursements, and payment status. Our payment provider, Wingspan, collects your bank account and tax identification details directly; Ignite does not store your full bank account number.",
                "Background and credentialing information, only when an assignment requires it and with any notice and consent the law requires.",
                "Communications: texts, emails, in-app messages, and support conversations with Ignite.",
                "When you check in through a public check-in link without signing in, the name, phone number, and optional email you enter.",
              ],
            },
            { h: "2.3 Consumers at events", id: "collect-consumers" },
            "Ambassadors record mostly anonymous program information, such as how many people sampled a product, purchases, and general comments or feedback. Event photos may show people who visited the display, including their faces. If a Client's program collects consumer contact details (for example, a sign-up or sweepstakes form), that information is collected for the Client and handled as its Client Data. Ambassadors are instructed not to photograph minors and to ask before featuring an identifiable person. Ambassadors may check a consumer's ID to confirm age for age-restricted products; we do not record ID numbers or images unless a program requires it and the law permits it.",
            { h: "2.4 Information collected automatically", id: "collect-automatic" },
            {
              list: [
                "Device and connection data: IP address, browser and device type, operating system, app version, and push-notification token.",
                "Usage data: pages and features used, actions taken, timestamps, errors, and performance information.",
                "Cookies and browser storage, described in Section 9.",
              ],
            },
          ],
        },
        {
          id: "location",
          number: "3",
          title: "Precise location information",
          body: [
            "Precise geolocation is sensitive personal information under several state privacy laws. We collect it from Ambassadors only for the work-related purposes below, and only with location permission on your device:",
            {
              list: [
                "Clock-in and clock-out: when you clock in or out, we record your location to verify you are at the assigned store or venue.",
                "During a scheduled activation in the mobile app: after you clock in, the app records your location about every two minutes, or when you move a meaningful distance, until you clock out. If you forget to clock out, collection stops automatically fifteen (15) minutes after the scheduled end time.",
                "Web check-in: the web check-in page records your location when you clock in and clock out, not in between.",
                "Mileage tracking: only if a trip is eligible for reimbursement and you turn it on. While a trip is active, the mobile app records points along your route and the web page records your start and end points, which we use to calculate driving distance.",
              ],
            },
            "We do not collect your location outside scheduled activations and active mileage trips. We use location to verify presence, prevent timekeeping fraud, calculate pay and mileage, show Ignite staff where active shifts are taking place, and resolve disputes. Clients may see whether and when you checked in at their program's location; we do not sell location data or use it for advertising. You can turn off location permission in your device settings at any time, but you will not be able to use clock-in or mileage features without it.",
          ],
        },
        {
          id: "how-we-use",
          number: "4",
          title: "How we use information",
          body: [
            {
              list: [
                "Provide the Platform: create and manage accounts, schedule and staff programs, run check-in and timekeeping, collect recaps, and produce dashboards and reports for Clients.",
                "Pay Ambassadors: calculate activation fees, overage, and reimbursements, and send payment information to our payment provider.",
                "Communicate: send shift reminders, recap reminders, approvals, account and security notices, and support replies.",
                "Run AI Features, as described in Section 5.",
                "Keep Spark safe: verify identity, secure accounts, detect fraud and abuse, enforce usage limits, and investigate violations of our Terms.",
                "Improve Spark: analyze usage, fix problems, and develop new features, using Aggregated Data where practical.",
                "Create Aggregated Data that does not identify any person or Client, for benchmarking and product development.",
                "Comply with law: meet tax, accounting, and legal obligations, respond to lawful requests, and establish or defend legal claims.",
              ],
            },
            "We do not sell personal information, and we do not share it for cross-context behavioral advertising.",
          ],
        },
        {
          id: "ai",
          number: "5",
          title: "AI features",
          body: [
            "Spark uses AI model providers, currently OpenAI, to power features such as recap summaries, receipt reading, photo checks, insights, and product question answering. When you use these features, we send the provider only the information needed for the feature, such as recap text, photos, receipts, or program data. We avoid sending Ambassador contact details to AI providers where the feature does not need them.",
            "We use the providers' business API services. Under their terms as we understand them on the date of this policy, data submitted through those APIs is not used to train the provider's models by default and may be retained by the provider for a limited period for abuse monitoring. AI outputs can be wrong, so we design features for human review, and AI is not used to make final decisions about Ambassador pay or eligibility without review by a person.",
            "Clients can connect an outside AI application, such as Claude or ChatGPT, to Spark through the official Spark MCP connection. The connection is read-only, limited to the Client user's own brands, and excludes Ambassadors' personal details. Information a Client user retrieves through that connection is handled by the AI application's provider under the user's own agreement with that provider.",
          ],
        },
        {
          id: "sharing",
          number: "6",
          title: "How we share information",
          body: [
            {
              list: [
                "With Clients: program results, recaps, photos, receipts, and limited Ambassador information needed to run and review the Client's programs (such as first name, photo, shift times, attendance, and recap submissions). Clients are contractually required to use Ambassador information only for their programs and not to export it or contact Ambassadors outside Spark for hiring.",
                "With Ambassadors: program details, store and event information, and instructions they need to do the work.",
                "With service providers that process information for us under contract, listed in Section 7.",
                "At your direction: for example, when a Client exports data, sends recaps to a Google Sheet, or connects an AI application.",
                "For legal reasons: to comply with law or legal process, respond to lawful requests from public authorities, protect the rights, safety, and property of Ignite, our users, or others, and enforce our agreements.",
                "In a business transfer: as part of a merger, acquisition, financing, or sale of assets, subject to this policy's protections.",
                "Aggregated Data that does not identify any person or Client.",
              ],
            },
          ],
        },
        {
          id: "service-providers",
          number: "7",
          title: "Service providers",
          body: [
            "We use the following service providers to operate Spark. They may access personal information only to perform services for us and are bound by contract or their published business terms to protect it. We may update this list as our services change.",
            {
              table: {
                head: ["Provider", "Purpose", "Information involved"],
                rows: SERVICE_PROVIDERS,
              },
            },
            "Ignite also uses ordinary business tools (such as email, document, accounting, and customer-relationship systems) to communicate with Clients and Ambassadors and run our business.",
          ],
        },
        {
          id: "messaging",
          number: "8",
          title: "Text messages and email",
          body: [
            "If you give us your mobile number, Ignite may send operational text messages about your account, shifts, check-in, recaps, payments, and support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help, or contact " +
              LEGAL_EMAIL +
              ".",
            "We do not sell, rent, or share mobile numbers or text-messaging opt-in data with third parties or affiliates for their marketing or promotional purposes. We share them only with the service providers that deliver our messages.",
            "We send transactional emails such as invitations, sign-in links, approvals, and reports. You can manage some notification emails in your settings; account and security notices cannot be turned off while you have an account.",
          ],
        },
        {
          id: "cookies",
          number: "9",
          title: "Cookies and browser storage",
          body: [
            "Spark uses cookies and similar browser storage (such as local storage) to keep you signed in, secure your session, remember preferences such as your theme and selected brand, and keep check-in progress if your connection drops. The Spark app does not use third-party advertising cookies. You can clear or block cookies and storage in your browser, but Spark may not work properly without them.",
            "Spark does not currently respond to browser \"Do Not Track\" signals because we do not track you across other websites. Where required by law, we treat Global Privacy Control signals as a request to opt out of sale or sharing, although we do not sell or share personal information.",
          ],
        },
        {
          id: "retention",
          number: "10",
          title: "How long we keep information",
          body: [
            "We keep personal information for as long as needed for the purposes in this policy, including:",
            {
              list: [
                "Account information: while the account is active, and for a reasonable period afterward in case the account is reactivated or a dispute arises.",
                "Ambassador work, payment, and location records: for as long as needed to pay you, resolve disputes, and meet tax, audit, and legal obligations, which may be several years after the work was performed.",
                "Client Data: for the term of the Client's agreement, then as described in our Terms (generally deleted within ninety (90) days after a Client's export period ends).",
                "Logs and security records: for a limited period appropriate to security and troubleshooting needs.",
              ],
            },
            "When information is no longer needed, we delete it or de-identify it. Backups are overwritten on a rolling schedule.",
          ],
        },
        {
          id: "security",
          number: "11",
          title: "Security",
          body: [
            "We use administrative, technical, and physical safeguards designed to protect personal information, including encryption in transit, sign-in protection, access controls based on each user's role and brands, and activity logging. No system is completely secure, so we cannot guarantee absolute security. If a security incident affects your personal information, we will notify you and others as required by law.",
          ],
        },
        {
          id: "your-rights",
          number: "12",
          title: "Your choices and rights",
          body: [
            "Depending on where you live, including California, Colorado, Connecticut, Virginia, Utah, Texas, Oregon, and other states with consumer privacy laws, you may have the right to:",
            {
              list: [
                "know what personal information we collect, use, and disclose, and get a copy of it in a portable format;",
                "correct inaccurate personal information;",
                "delete personal information, subject to legal exceptions (for example, records we must keep for tax or to resolve a dispute);",
                "opt out of the sale or sharing of personal information, or of targeted advertising or profiling (we do not do these);",
                "limit the use of sensitive personal information (we use precise location only for the purposes in Section 3, which are permitted without a separate opt-out under applicable law); and",
                "not be discriminated or retaliated against for exercising these rights.",
              ],
            },
            "To make a request, email " +
              LEGAL_EMAIL +
              ' with "Privacy request" in the subject line. We will verify your identity by matching information we hold, such as your phone number or email. You may use an authorized agent, who must provide proof of authorization. If we deny your request, you may appeal by replying to our response; if you are not satisfied with the result of an appeal, you may contact your state attorney general.',
            "If your request concerns information we process for a Client, we will forward it to the Client or ask you to contact the Client directly.",
            "California notice at collection: the categories of personal information we collect are identifiers, contact information, commercial and payment information, internet and device activity, precise geolocation, audio-visual information (photos and videos), professional and work-related information, and inferences such as performance ratings. We collect them for the purposes in Section 4, disclose them as described in Sections 6 and 7, and keep them as described in Section 10. We do not sell or share personal information.",
          ],
        },
        {
          id: "children",
          number: "13",
          title: "Children and age limits",
          body: [
            "Spark is not directed to children under 13, and we do not knowingly collect personal information from them. Accounts are for people 18 and older, and programs involving alcohol or other age-restricted products are directed only to people of legal age, generally 21 and older. If we learn that we collected information from a child under 13, or that an event photo shows a minor in a way that should not be retained, we will delete it. Contact us if you believe this has happened.",
          ],
        },
        {
          id: "location-of-processing",
          number: "14",
          title: "Where we process information",
          body: [
            "Spark is operated from the United States and is intended for use in the United States. We and our service providers store and process information in the United States. If you access Spark from elsewhere, your information will be transferred to and processed in the United States.",
          ],
        },
        {
          id: "changes",
          number: "15",
          title: "Changes to this policy",
          body: [
            "We may update this policy from time to time. We will post the new version with a revised \"last updated\" date and, for material changes, notify you through Spark or by email before they take effect.",
          ],
        },
        {
          id: "contact",
          number: "16",
          title: "Contact",
          body: [
            "Questions, requests, or concerns about privacy can be sent to:",
            { list: LEGAL_CONTACT_LINES },
          ],
        },
      ],
    },
  ],
};
