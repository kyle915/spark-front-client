import type { LegalDocument } from "./types";
import {
  LEGAL_COMPANY,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_PLATFORM,
} from "./common";

export const acceptableUsePolicy: LegalDocument = {
  slug: "acceptable-use-policy",
  title: "Acceptable Use Policy",
  navLabel: "Acceptable use",
  path: "/acceptable-use-policy",
  company: LEGAL_COMPANY,
  platform: LEGAL_PLATFORM,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_EFFECTIVE_DATE,
  intro: [
    "This Acceptable Use Policy sets the rules for using Spark by Ignite. It is part of the [Terms of Service](/terms-of-service) and applies to everyone who accesses Spark, including Clients, their Authorized Users, Ambassadors, and anyone using an application connected to Spark. Capitalized terms have the meaning given in the Terms.",
  ],
  parts: [
    {
      id: "aup",
      label: "",
      title: "",
      sections: [
        {
          id: "security",
          number: "1",
          title: "Protect accounts and the Platform",
          body: [
            "You may not:",
            {
              list: [
                "share your login, let anyone else use your account, or use another person's account;",
                "access, or try to access, data, brands, or accounts you are not authorized to see;",
                "probe, scan, or test the Platform for vulnerabilities, or bypass authentication, access controls, rate limits, or usage quotas (to report a security issue, email " +
                  LEGAL_EMAIL +
                  ");",
                "upload malware or interfere with or overload the Platform; or",
                "reverse engineer the Platform or use it to build or improve a competing product.",
              ],
            },
          ],
        },
        {
          id: "automated-access",
          number: "2",
          title: "Automated access and AI applications",
          body: [
            "Bots, scripts, crawlers, AI agents, headless browsers, browser extensions, and copied session or authentication tokens may not be used to access Spark, except through the official Spark MCP connection or another integration Ignite approves in writing (an \"Approved Integration\").",
            {
              list: [
                "Use an Approved Integration only with your own account and only for the brands you are authorized to view.",
                "Do not use any integration or automated means to scrape, bulk-export, mirror, or archive Spark data, or to collect Ambassador Personal Information.",
                "Stay within rate limits and daily quotas. Do not use multiple accounts, connections, or tokens to get around them.",
                "You are responsible for everything an application you connect does with your access.",
              ],
            },
          ],
        },
        {
          id: "data",
          number: "3",
          title: "Respect people's information",
          body: [
            {
              list: [
                "Use Ambassador information only to run and review your programs in Spark. Do not copy it out of Spark, compile lists, or contact Ambassadors outside Spark to recruit or hire them (see Sections 22 and 23 of the Terms).",
                "Collect consumer information only through Spark or other Ignite-approved methods, only when the program calls for it, and never for personal use.",
                "Do not upload sensitive information (such as government ID numbers, health information, or financial account numbers) unless Ignite has agreed in writing.",
                "Do not photograph minors, and ask before featuring an identifiable person in a photo.",
              ],
            },
          ],
        },
        {
          id: "honest-records",
          number: "4",
          title: "Keep records honest",
          body: [
            {
              list: [
                "Do not falsify or alter clock-in and clock-out times, location data, recaps, consumer counts, sales figures, photos, receipts, or mileage.",
                "Do not use location-spoofing apps or other tools to misrepresent where you are.",
                "Do not submit photos or receipts that are not from the activation they are attached to.",
              ],
            },
          ],
        },
        {
          id: "field-conduct",
          number: "5",
          title: "Field conduct and regulated products",
          body: [
            {
              list: [
                "Follow all laws, retailer and venue rules, and program instructions for age verification and responsible sampling. Never offer age-restricted products to anyone under the legal age or who appears intoxicated.",
                "Use only approved product information. Do not make health, medical, potency, or comparative claims you were not given.",
                "Do not use Spark to plan or carry out sampling or sales that are unlawful where they take place.",
              ],
            },
          ],
        },
        {
          id: "content",
          number: "6",
          title: "Content and communications",
          body: [
            "Do not use Spark to upload, send, or share content that is unlawful, infringing, defamatory, harassing, threatening, hateful, sexually explicit, or that invades anyone's privacy, and do not harass or discriminate against any Ambassador, Client user, consumer, or Ignite staff member. Do not use Spark to send spam or unsolicited marketing.",
          ],
        },
        {
          id: "reporting",
          number: "7",
          title: "Reporting violations",
          body: [
            "If you see something that violates this policy or a security problem, email " +
              LEGAL_EMAIL +
              ". Please do not test or exploit a vulnerability beyond what is needed to report it.",
          ],
        },
        {
          id: "enforcement",
          number: "8",
          title: "Enforcement",
          body: [
            "Ignite may monitor use of Spark to enforce this policy. If we believe this policy has been violated, we may remove content, revoke tokens or connections, limit or suspend access, remove an Ambassador from assignments, withhold payment for falsified work as the Terms allow, terminate accounts, and report unlawful activity to authorities. We may act without notice where needed to protect people, data, or the Platform.",
            "We may update this policy from time to time by posting a new version with a revised date.",
          ],
        },
      ],
    },
  ],
};
