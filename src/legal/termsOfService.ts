import type { LegalDocument } from "./types";
import {
  LEGAL_COMPANY,
  LEGAL_CONTACT_LINES,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_PLATFORM,
} from "./common";

export const termsOfService: LegalDocument = {
  slug: "terms-of-service",
  title: "Terms of Service",
  navLabel: "Terms",
  path: "/terms-of-service",
  pdfPath: "/legal/terms-of-service.pdf",
  company: LEGAL_COMPANY,
  platform: LEGAL_PLATFORM,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_EFFECTIVE_DATE,
  intro: [
    'These Terms of Service ("Terms") are a binding agreement between you and Ignite Productions LLC, a Nevada limited liability company and Veteran-Owned Small Business ("Ignite," "we," "us," or "our"). They govern your access to and use of Spark by Ignite, including our web and mobile apps, dashboards, public check-in and job pages, APIs, the Spark MCP connection, and related services (together, the "Platform" or "Spark").',
    "These Terms are organized in four parts. Part A applies to everyone. Part B applies to brands and other businesses that use Spark to run programs (\"Clients\") and their users. Part C applies to brand ambassadors and other field personnel (\"Ambassadors\"). Part D contains general legal terms that apply to everyone.",
    {
      caps: "IMPORTANT: THESE TERMS CONTAIN A BINDING ARBITRATION AGREEMENT AND CLASS ACTION WAIVER (SECTION 41) THAT AFFECT HOW DISPUTES ARE RESOLVED, AND THEY LIMIT IGNITE'S LIABILITY (SECTION 39). PLEASE READ THEM CAREFULLY.",
    },
  ],
  parts: [
    /* ------------------------------------------------------------------ */
    {
      id: "part-a",
      label: "Part A",
      title: "Terms for everyone",
      appliesTo: "Applies to every person and organization that accesses Spark.",
      sections: [
        {
          id: "acceptance",
          number: "1",
          title: "Agreement and acceptance",
          body: [
            "By creating an account, checking a box or clicking a button that references these Terms, clocking in through a public check-in link, or otherwise accessing or using the Platform, you agree to these Terms, the [Privacy Policy](/privacy-policy), and the [Acceptable Use Policy](/acceptable-use-policy), each of which is part of these Terms. If you do not agree, do not use the Platform.",
            "If you use the Platform on behalf of a company or other organization, you represent that you are authorized to accept these Terms for it, and \"you\" includes that organization.",
            "If you and Ignite have signed a master services agreement, statement of work, order form, or similar document (an \"Order\"), that Order controls over these Terms where they conflict, as described in Section 47.",
          ],
        },
        {
          id: "definitions",
          number: "2",
          title: "Definitions",
          body: [
            "In these Terms:",
            {
              list: [
                '"Ambassador" means a brand ambassador, demo specialist, field lead, or other individual who performs field marketing services through the Platform, whether engaged by Ignite or invited by a Client.',
                '"Authorized User" means an individual a Client permits to use the Platform under its account, including its employees, contractors, distributors, brokers, and agencies.',
                '"Client" means a business (typically a consumer brand) that uses the Platform to plan, staff, or report on field marketing programs, under an Order or otherwise.',
                '"Client Data" means data and materials a Client or its Authorized Users submit to the Platform, and Program Data generated for that Client\'s programs, excluding Ambassador Personal Information and Ignite Property.',
                '"Program Data" means event, activation, and campaign records generated for a Client\'s programs, including requests, schedules, recaps, consumer counts, sales and sampling figures, comments, photos, videos, and receipts.',
                '"Ambassador Personal Information" means information that identifies or relates to an Ambassador, including name, contact details, location data, payment and tax information, availability, performance history, and photos of the Ambassador.',
                '"Aggregated Data" means data that has been aggregated or de-identified so that it does not identify a Client, an Ambassador, or any individual.',
                '"Usage Data" means technical and usage information about how the Platform is accessed and performs, such as logs, device and browser information, and feature usage.',
                '"Approved Integration" has the meaning given in Section 7.1.',
                '"AI Features" means Platform features that use machine learning or large language models, described in Section 9.',
              ],
            },
          ],
        },
        {
          id: "eligibility",
          number: "3",
          title: "Eligibility",
          body: [
            "To use the Platform you must be at least 18 years old (or the age of majority where you live, if higher), able to form a binding contract, and not barred from using the Platform under applicable law, including U.S. sanctions laws.",
            "Assignments that involve sampling or promoting alcohol, hemp-derived or cannabis products, nicotine, or other age-restricted products may require you to be 21 or older, or to meet other requirements set by law, the retailer, or the Client.",
            "You must give accurate, current, and complete information when you register and keep it up to date.",
          ],
        },
        {
          id: "accounts",
          number: "4",
          title: "Accounts and security",
          body: [
            "Each account is for one named individual. You may not share your login credentials, let anyone else use your account, or use another person's account. Clients must issue a separate account to each Authorized User.",
            "You are responsible for keeping your credentials confidential, for using a strong password and any additional sign-in protection we offer, and for all activity under your account. Tell us right away at " +
              LEGAL_EMAIL +
              " if you believe your account has been accessed without permission.",
            "We may require identity verification, reset credentials, or limit access when we believe an account is at risk.",
          ],
        },
        {
          id: "platform",
          number: "5",
          title: "The Platform",
          body: [
            "Spark is a field marketing operations platform. Depending on your role, it lets you request, schedule, and staff events and activations; clock in and out with location verification; submit recaps, photos, and receipts; view dashboards, KPIs, and reports; manage payments to Ambassadors; and use AI Features.",
            "Spark is a technology tool. Ignite does not guarantee business results, sales, conversions, or campaign performance. Dashboards, metrics, and insights are provided for information and depend on the accuracy of the data entered.",
            "We continually change the Platform. We may add, modify, or remove features, and we may offer early-access or beta features, which are provided as-is and may be discontinued at any time. If a change materially reduces core functionality a Client has paid for under an Order, the Order's terms govern any remedy.",
          ],
        },
        {
          id: "license",
          number: "6",
          title: "Your license and restrictions",
          body: [
            "Subject to these Terms, Ignite grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable right to access and use the Platform for its intended purpose: running, staffing, performing, or reviewing field marketing programs. Clients may use the Platform only for their own internal business purposes.",
            "You may not, and may not allow anyone else to:",
            {
              list: [
                "copy, modify, or create derivative works of the Platform, or reverse engineer, decompile, disassemble, or attempt to discover its source code, models, or underlying structure, except to the limited extent applicable law expressly permits despite this restriction;",
                "sell, resell, rent, lease, sublicense, white-label, or provide the Platform to third parties, or use it to run a service bureau or time-sharing arrangement;",
                "access or use the Platform, its outputs, or Ignite's Confidential Information to build, train, benchmark, or improve a competing product or service, or copy its features, workflows, data models, or design;",
                "remove or alter any proprietary notices, or frame or mirror any part of the Platform;",
                "access the Platform by automated means except as allowed in Section 7.1; or",
                "use the Platform in violation of the [Acceptable Use Policy](/acceptable-use-policy) or applicable law.",
              ],
            },
            "All rights not expressly granted in these Terms are reserved by Ignite and its licensors.",
          ],
        },
        {
          id: "acceptable-use",
          number: "7",
          title: "Acceptable use",
          body: [
            "You must follow the [Acceptable Use Policy](/acceptable-use-policy). Among other things, you may not:",
            {
              list: [
                "use the Platform for any unlawful, fraudulent, or harmful purpose;",
                "submit false, misleading, or fabricated information, including falsified clock-in or clock-out records, recaps, photos, receipts, or event data;",
                "circumvent, disable, or interfere with location verification, security features, access controls, rate limits, or usage quotas;",
                "probe, scan, or test the vulnerability of the Platform, or upload viruses or other harmful code;",
                "scrape, crawl, harvest, or bulk-export data from the Platform, except through features we provide for that purpose or an Approved Integration;",
                "access data you are not authorized to see, including another Client's data;",
                "harass, threaten, discriminate against, or misuse the information of any Ambassador, Client user, consumer, or Ignite personnel; or",
                "upload content that infringes others' rights or that is unlawful, obscene, or defamatory.",
              ],
            },
            { h: "7.1 Automated access and AI applications", id: "automated-access" },
            'Automated access to the Platform, including through bots, scripts, crawlers, AI agents or assistants, headless browsers, browser extensions, or copied session or authentication tokens, is prohibited except through Ignite\'s official Spark MCP connection or another integration Ignite approves in writing (each, an "Approved Integration").',
            "You may use an Approved Integration only with your own Platform account, and only to access data for the brands your account is authorized to view. You are responsible for all activity carried out through the applications you connect, and for that application provider's handling of the data you choose to send to it.",
            "Approved Integrations do not provide access to Ambassador Personal Information, and you may not use any integration or automated means to collect it.",
            { h: "7.2 Rate limits and quotas", id: "rate-limits" },
            "Rate limits, daily usage quotas, date-range limits, and other technical limits apply to the Platform and to Approved Integrations. You may not attempt to circumvent them, including by using multiple accounts, connections, or tokens. We may change these limits at any time to protect the Platform.",
            { h: "7.3 Monitoring and enforcement", id: "enforcement" },
            "We may monitor use of the Platform, including Approved Integrations, for security, abuse prevention, quota enforcement, and compliance with these Terms. We may investigate suspected violations and may, with or without notice, remove content, suspend, limit, or revoke any account, token, or connection, or take other action we consider appropriate, including when we believe it is being used for bulk data extraction, to access data beyond your authorization, or otherwise in violation of these Terms.",
          ],
        },
        {
          id: "user-content",
          number: "8",
          title: "Content you submit",
          body: [
            'You are responsible for the information, photos, videos, comments, receipts, and other content you submit to the Platform ("User Content"). You represent that you have the rights needed to submit it, that it is accurate, and that it does not violate the law or anyone else\'s rights, including privacy and publicity rights.',
            "You grant Ignite a worldwide, royalty-free, non-exclusive license to host, store, copy, process, transmit, display, modify (for example, to resize or compress), and create derivative works from User Content as needed to operate, provide, secure, support, and improve the Platform and to perform services for Clients, and as further described in Part B (for Client Data) and Part C (for Ambassador work product). This license survives termination for as long as Ignite retains the content as permitted by these Terms.",
            "We may review, refuse, remove, or blur User Content that we believe violates these Terms or the law, but we have no obligation to monitor it.",
          ],
        },
        {
          id: "ai-features",
          number: "9",
          title: "AI features",
          body: [
            "Spark includes AI Features, such as recap and program summaries, receipt reading, photo checks, insights, and answers to product questions. AI Features are provided by Ignite using third-party AI model providers acting as our service providers, currently including OpenAI.",
            "AI outputs are generated automatically and may be incomplete, inaccurate, or out of date. They are not professional, legal, regulatory, or financial advice. You are responsible for reviewing outputs before relying on them, and important decisions (for example, approving recaps, paying Ambassadors, or making product or compliance claims) should be confirmed by a person.",
            "We send AI providers only the information needed for the feature. Under the providers' business API terms as we understand them on the date of these Terms, data submitted through their APIs is not used to train their models by default, and may be retained by the provider for a limited period for abuse monitoring. Ignite does not use Client Data to train third-party foundation models.",
            "If you connect an outside AI application (such as Claude or ChatGPT) through an Approved Integration, the data you retrieve is sent to that application under your own agreement with its provider, not under Ignite's control.",
          ],
        },
        {
          id: "privacy",
          number: "10",
          title: "Privacy",
          body: [
            "Our [Privacy Policy](/privacy-policy) explains how we collect, use, and share personal information, including precise location information collected from Ambassadors during scheduled activations. Clients should also review the [Data Processing Summary](/data-processing).",
            "The Platform uses cookies and browser storage to keep you signed in, secure your session, and remember preferences, as described in the Privacy Policy.",
          ],
        },
        {
          id: "communications",
          number: "11",
          title: "Communications and text messages",
          body: [
            "By providing your email address or mobile number, you agree that Ignite may contact you about your account, assignments, shifts, recaps, payments, approvals, security, and the Platform by email, push notification, in-app message, phone, and text message (SMS/MMS).",
            { h: "11.1 Text messages", id: "sms" },
            "If you provide a mobile number (for example, when you sign up or check in for a shift), you consent to receive operational text messages from Ignite at that number, such as shift reminders, check-in and clock-out reminders, missing-recap reminders, and support replies. These messages may be sent using automated technology. Consent is not a condition of any purchase.",
            {
              list: [
                "Message frequency varies with your schedule and activity.",
                "Message and data rates may apply.",
                "Reply STOP to opt out at any time; reply HELP for help, or contact " +
                  LEGAL_EMAIL +
                  ".",
                "Carriers are not liable for delayed or undelivered messages.",
                "We do not share your mobile number or text-messaging consent with third parties for their marketing purposes.",
              ],
            },
            "If you opt out, you may miss time-sensitive shift information; you remain responsible for checking your schedule in the Platform.",
            "You agree to notify us promptly if you change or give up a mobile number you provided.",
          ],
        },
        {
          id: "third-party",
          number: "12",
          title: "Third-party services",
          body: [
            "The Platform works with third-party services, such as payment providers, mapping services, cloud hosting, messaging providers, AI providers, Google Sheets exports, and AI applications you connect. Your use of a third-party service is governed by that provider's terms and privacy practices.",
            "Ignite is not responsible for third-party services, their availability, or their acts and omissions, except to the extent Ignite has agreed otherwise in an Order or is responsible under applicable data protection law for its own service providers.",
          ],
        },
        {
          id: "feedback",
          number: "13",
          title: "Feedback",
          body: [
            "If you give us suggestions, ideas, or other feedback about the Platform, you grant Ignite a perpetual, irrevocable, worldwide, royalty-free right to use and incorporate it without restriction or obligation to you. Feedback does not include your Confidential Information or Client Data.",
          ],
        },
        {
          id: "confidentiality",
          number: "14",
          title: "Confidentiality",
          body: [
            '"Confidential Information" means non-public information disclosed by one party to the other that is marked confidential or that a reasonable person would understand to be confidential, including Client Data, Ambassador Personal Information, pricing, program plans, product launches, and the non-public aspects of the Platform (including its features, roadmap, security, and performance). It does not include information that is or becomes public through no fault of the recipient, was already known to the recipient without restriction, is independently developed, or is rightfully received from a third party without a duty of confidentiality.',
            "The recipient will use Confidential Information only to perform under or exercise rights under these Terms, protect it with at least reasonable care, and disclose it only to its personnel, contractors, and advisors who need to know it and are bound by confidentiality obligations at least as protective. The recipient may disclose Confidential Information when required by law, after giving prompt notice where legally permitted.",
            "These obligations last while you use the Platform and for three (3) years afterward, and for trade secrets and personal information, for as long as they remain protected by law.",
            "Nothing in these Terms prevents anyone from reporting possible violations of law to a government agency, participating in an investigation, or making other disclosures protected by law, including under the Defend Trade Secrets Act.",
          ],
        },
        {
          id: "suspension",
          number: "15",
          title: "Suspension and termination",
          body: [
            "You may stop using the Platform at any time. Clients may terminate as provided in their Order or Section 27. Ambassadors may close their account by contacting us, subject to Part C.",
            "We may suspend or terminate your access, in whole or in part, immediately and without liability, if we reasonably believe you have violated these Terms or the law, your use poses a security, legal, or reputational risk to Ignite, a Client, an Ambassador, or the Platform, or we are required to do so by law. Where practical and lawful, we will tell you why. If you are a Client, we will give advance notice and an opportunity to cure where the issue reasonably permits it.",
            "Sections that by their nature should survive termination will survive, including Sections 6, 8, 13, 14, 18 through 23, 26, 27.3, Part C obligations about confidentiality, property, and repayment, and all of Part D.",
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "part-b",
      label: "Part B",
      title: "Terms for Clients",
      appliesTo:
        "Applies to Clients (brands and other businesses that use Spark to run programs) and their Authorized Users.",
      sections: [
        {
          id: "orders",
          number: "16",
          title: "Orders and services",
          body: [
            "Ignite provides the Platform and any field marketing, staffing, or other services to Clients under an Order. The Order sets the scope, programs, pricing, term, and any service-specific commitments. If a Client uses the Platform without an Order, these Terms alone apply and Ignite may change or discontinue that access at any time.",
            "Field services performed by Ambassadors engaged by Ignite are Ignite's services to the Client. Ambassadors are not the Client's employees or agents, and the Client will not direct or control their work except through Ignite or the program instructions agreed with Ignite.",
          ],
        },
        {
          id: "authorized-users",
          number: "17",
          title: "Authorized Users",
          body: [
            "A Client may allow its Authorized Users to use the Platform under its account. The Client is responsible for its Authorized Users' compliance with these Terms and for all activity under their accounts, as if it were the Client's own.",
            "The Client will keep its list of Authorized Users current, promptly remove access for people who leave or no longer need it, and ensure that each user has their own login. Credential sharing is prohibited.",
            "A Client may invite distributors, brokers, retailers, or agencies as Authorized Users only for the Client's programs, and remains responsible for them.",
          ],
        },
        {
          id: "fees",
          number: "18",
          title: "Fees and payment",
          body: [
            "The Client will pay the fees in its Order. Unless the Order says otherwise, fees are invoiced as stated in the Order, payable in U.S. dollars, and due within thirty (30) days after the invoice date, and fees are non-refundable except as the Order provides or the law requires.",
            "Fees exclude taxes. The Client is responsible for sales, use, value-added, and similar taxes on the services, other than taxes on Ignite's income.",
            "If the Client disputes an invoice in good faith, it must notify Ignite in writing with reasonable detail within fifteen (15) days after the invoice date and pay the undisputed portion on time.",
            "Overdue undisputed amounts may accrue interest at the lesser of 1.5% per month or the maximum rate allowed by law, and the Client will reimburse reasonable collection costs. If undisputed amounts remain unpaid ten (10) days after Ignite gives written notice of non-payment, Ignite may suspend the Platform and services until they are paid.",
            "Ignite may change its pricing for renewal terms or new Orders by giving notice before the renewal or new Order takes effect. Pricing in an executed Order does not change during its term unless the Order allows it.",
          ],
        },
        {
          id: "client-data",
          number: "19",
          title: "Client Data",
          body: [
            "As between the Client and Ignite, the Client owns its Client Data, subject to Section 21 for Event Content and to Ignite's rights in Ignite Property and Aggregated Data.",
            "The Client grants Ignite and its service providers a worldwide, royalty-free, non-exclusive license to host, copy, process, transmit, display, and otherwise use Client Data to provide, secure, support, and maintain the Platform and services; to prevent fraud and abuse; to comply with law; to create Aggregated Data; and to improve the Platform, including its features and AI Features, provided that Ignite does not disclose Client Data to other clients in identifiable form.",
            "The Client is responsible for the accuracy, quality, and legality of Client Data it provides and for having all rights, notices, and consents needed for Ignite to use it as described in these Terms, including for any consumer information the Client asks Ambassadors to collect.",
            "The Client should not submit sensitive personal information (such as government ID numbers, health information, or financial account numbers of consumers) unless Ignite has agreed in writing.",
          ],
        },
        {
          id: "ignite-property",
          number: "20",
          title: "Ignite Property, Aggregated Data, and Usage Data",
          body: [
            'Ignite and its licensors own all right, title, and interest in the Platform and everything Ignite provides or develops in connection with it, including its software, AI Features and prompts, designs, data models, reporting frameworks, benchmarks, dashboards, analytics methodologies, templates, training materials, documentation, trademarks (including "Spark by Ignite," "Spark," and "Ignite Productions"), and all improvements and derivative works of them, whether or not based on Client feedback ("Ignite Property").',
            "Ignite owns Aggregated Data and Usage Data and may use them for any lawful purpose during and after the term, including benchmarking, industry reporting, product development, and analytics, provided that Ignite does not disclose them in a form that identifies the Client, any Ambassador, or any individual.",
            "Nothing in these Terms transfers ownership of Ignite Property to the Client. Any custom configurations, templates, or reports Ignite builds for a Client are Ignite Property, licensed to the Client for its use of the Platform, except to the extent an Order expressly assigns specific deliverables to the Client.",
          ],
        },
        {
          id: "event-content",
          number: "21",
          title: "Event photos and content",
          body: [
            '"Event Content" means photos, videos, and other media captured by Ambassadors or Ignite personnel during a Client\'s programs and submitted through the Platform.',
            "Ambassadors engaged by Ignite assign their rights in Event Content to Ignite under their contractor agreements. Upon the Client's payment in full of the fees for the related services, Ignite assigns to the Client its rights in the Event Content from that Client's programs, and until then grants the Client a non-exclusive license to use it for internal review. Ignite retains a perpetual, royalty-free license to use Event Content to provide and improve the Platform and services, to create Aggregated Data, and, unless the Client opts out in writing, to show it in Ignite's portfolio, case studies, and marketing in a manner that does not disclose the Client's confidential results.",
            "Event Content may show members of the public, store employees, retail premises, and third-party trademarks. Ignite does not obtain model or property releases unless an Order says so. Before using Event Content in advertising or other public-facing materials, the Client is responsible for obtaining any releases, consents, and retailer approvals required by law or contract, and for complying with right-of-publicity, privacy, and advertising laws. Ignite instructs Ambassadors not to photograph minors and to ask before featuring an identifiable consumer, but does not guarantee that every image complies.",
            "Receipts, ID-check results, and other operational records submitted for payment, reimbursement, or compliance are Program Data, not Event Content, and are used for those purposes.",
          ],
        },
        {
          id: "ambassador-information",
          number: "22",
          title: "Ambassador personal information",
          body: [
            "Ambassador Personal Information is collected and controlled by Ignite. A Client may see limited Ambassador information (such as first names, photos, shift times, recap submissions, and attendance) where needed to review and run its programs.",
            "The Client and its Authorized Users may use Ambassador Personal Information only to review, manage, and communicate about the Client's programs on the Platform, and must:",
            {
              list: [
                "not copy, export, scrape, compile, or store Ambassador Personal Information outside the Platform, except as reasonably needed for a specific program (for example, a venue credential list), and delete it when no longer needed for that purpose;",
                "not contact Ambassadors outside the Platform or Ignite's designated channels to recruit, solicit, hire, or engage them, or to direct their work, except as Section 23 permits;",
                "not sell, share, or disclose Ambassador Personal Information to any third party, or use it for marketing, advertising, profiling, or employment decisions;",
                "comply with applicable privacy, data security, and employment laws in handling it; and",
                "notify Ignite promptly of any unauthorized access to or use of Ambassador Personal Information in its possession.",
              ],
            },
          ],
        },
        {
          id: "non-solicitation",
          number: "23",
          title: "Non-solicitation and non-circumvention",
          body: [
            "Ignite invests substantially in recruiting, vetting, training, and managing its Ambassador network and staff. During the term of the Client's use of the Platform or services and for twelve (12) months afterward, the Client will not, directly or through an affiliate, agency, staffing company, or other third party:",
            {
              list: [
                "solicit, recruit, hire, or engage, as an employee, contractor, or through another provider, any Ambassador who performed services on the Client's programs through Ignite or whom the Client identified through the Platform, for field marketing, sampling, demo, event, or similar services; or",
                "solicit or hire any Ignite employee or contractor staff member (such as program managers and field leads) with whom the Client had contact in connection with the services; or",
                "otherwise circumvent Ignite by arranging services directly with those individuals or by using the Platform to source staff for another provider.",
              ],
            },
            "General job postings not targeted at Ignite personnel, and hiring a person who responds to them without solicitation, do not violate this Section.",
            "If the Client wishes to engage such a person directly, the Client may do so with Ignite's prior written approval by paying Ignite a placement fee equal to the amount stated in the Order or, if none is stated, twenty-five percent (25%) of the person's first-year annualized compensation for the role. The parties agree this fee is a reasonable estimate of Ignite's recruiting and training investment and not a penalty.",
            "This Section does not restrict any individual's ability to work for anyone; it governs only the Client's conduct.",
          ],
        },
        {
          id: "client-compliance",
          number: "24",
          title: "Product, regulatory, and sampling compliance",
          body: [
            "The Client is solely responsible for its products and for the legal and regulatory compliance of its programs, including:",
            {
              list: [
                "product safety, labeling, ingredients, formulation, and quality, and any recall or withdrawal;",
                "the truthfulness and substantiation of all product claims, talking points, and marketing materials it provides or approves, including health, functional, potency, and comparative claims;",
                "the laws and regulations that apply to its product category, including alcohol beverage laws (federal, state, and local, including tied-house, sampling, and trade practice rules), hemp-derived THC, cannabis, CBD, kratom, nicotine and tobacco, dietary supplement, energy drink and caffeine, and food laws;",
                "obtaining required licenses, permits, registrations, and retailer and venue approvals for sampling and events, and identifying the age and other restrictions that apply to each program;",
                "supplying product that is lawful to sample or sell where the program takes place, with accurate instructions for serving sizes and responsible-service limits; and",
                "maintaining appropriate product liability insurance, and naming Ignite as an additional insured where an Order requires it.",
              ],
            },
            "Ignite is responsible for its own conduct and for directing Ambassadors to follow the program instructions, age-verification procedures, and responsible-service rules agreed with the Client or required by law. Ignite is not responsible for determining whether the Client's products, claims, or programs are lawful, and may decline or stop any activity that Ignite believes is unlawful or unsafe without liability.",
          ],
        },
        {
          id: "data-processing",
          number: "25",
          title: "Data processing and security",
          body: [
            "When Ignite processes personal information contained in Client Data on the Client's behalf, Ignite acts as the Client's service provider or processor, as described in the [Data Processing Summary](/data-processing), which is part of these Terms. A full data processing agreement is available on request.",
            "Ignite maintains commercially reasonable administrative, technical, and physical safeguards designed to protect Client Data, uses service providers bound by appropriate obligations, and will notify the Client without undue delay, and in any event within seventy-two (72) hours, after confirming a security incident that compromises the Client's Client Data, and will provide information reasonably needed for the Client to meet its obligations.",
            "Ignite acts as an independent business (controller) for Ambassador Personal Information, Usage Data, and account information of Authorized Users used to administer accounts.",
          ],
        },
        {
          id: "client-indemnity",
          number: "26",
          title: "Indemnification",
          body: [
            { h: "26.1 By the Client", id: "client-indemnifies" },
            "The Client will defend Ignite and its members, officers, employees, contractors (including Ambassadors), and agents against any third-party claim, demand, investigation, or proceeding, and indemnify them for resulting losses, damages, fines, penalties, settlements, and reasonable attorneys' fees, to the extent arising out of or relating to:",
            {
              list: [
                "the Client's products, including their design, manufacture, labeling, safety, composition, legality, and any illness, injury, or property damage they cause;",
                "product claims, talking points, or materials the Client provides or approves;",
                "the Client's failure to comply with Section 24 or with laws applicable to its products or programs;",
                "Client Data or the Client's instructions, including any claim that they infringe or violate a third party's rights or privacy;",
                "the Client's or its Authorized Users' breach of Sections 7, 22, or 23; or",
                "the Client's use of Event Content in advertising or public-facing materials.",
              ],
            },
            { h: "26.2 By Ignite", id: "ignite-indemnifies" },
            "Ignite will defend the Client against any third-party claim alleging that the Platform, as provided by Ignite and used in accordance with these Terms, infringes a U.S. patent, copyright, or trademark or misappropriates a trade secret, and against third-party claims for bodily injury or tangible property damage to the extent caused by the gross negligence or willful misconduct of Ignite personnel in performing services, and will indemnify the Client for resulting damages finally awarded or settlements Ignite approves.",
            "Ignite has no obligation under the first part of this Section 26.2 for claims arising from Client Data, the Client's instructions, combinations with items not provided by Ignite, modifications not made by Ignite, or use not permitted by these Terms. If the Platform is, or Ignite believes it may be, subject to such a claim, Ignite may obtain the right for the Client to continue using it, modify it to be non-infringing, or terminate the affected service and refund prepaid fees for the unused period. This Section 26.2 states Ignite's entire liability for infringement claims.",
            { h: "26.3 Procedure", id: "indemnity-procedure" },
            "The indemnified party must give prompt written notice of the claim (a delay excuses the indemnifying party only to the extent it is prejudiced), give the indemnifying party sole control of the defense and settlement, and provide reasonable cooperation at the indemnifying party's expense. The indemnifying party may not settle a claim in a way that admits fault by or imposes non-monetary obligations on the indemnified party without its consent, which may not be unreasonably withheld.",
          ],
        },
        {
          id: "client-term",
          number: "27",
          title: "Term, termination, and your data",
          body: [
            { h: "27.1 Term", id: "client-term-length" },
            "The term of a Client's subscription and services is stated in its Order. If there is no Order, either party may end the Client's access on thirty (30) days' written notice.",
            { h: "27.2 Termination for cause", id: "client-termination-cause" },
            "Either party may terminate an Order on written notice if the other party materially breaches it or these Terms and does not cure the breach within thirty (30) days after notice (ten (10) days for non-payment), or if the other party becomes insolvent or the subject of bankruptcy or similar proceedings. Termination does not relieve the Client of fees for services performed or committed through the termination date, as the Order provides.",
            { h: "27.3 Data export and deletion", id: "client-data-export" },
            "For thirty (30) days after termination or expiration, on request, Ignite will make the Client's Client Data available for export in a standard format (such as CSV, XLSX, PDF, or image files) through the Platform or as Ignite reasonably provides. After that period Ignite may delete Client Data and will do so within ninety (90) days, except for copies retained in backups until they are overwritten in the ordinary course, data Ignite must keep to comply with law, resolve disputes, or enforce its agreements, records needed to pay Ambassadors and meet tax obligations, and Aggregated Data. Retained data remains subject to the confidentiality obligations in these Terms.",
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "part-c",
      label: "Part C",
      title: "Terms for Ambassadors",
      appliesTo:
        "Applies to brand ambassadors, demo specialists, field leads, and other field personnel. Your Independent Contractor Agreement and the Activation Completion Policy also apply and control where they conflict with this Part.",
      sections: [
        {
          id: "contractor-status",
          number: "28",
          title: "Independent contractor status",
          body: [
            "Nothing in these Terms creates an employment, partnership, joint venture, or agency relationship between Ignite (or any Client) and any Ambassador.",
            "Ambassadors who perform project-based assignments through the Platform are engaged as independent contractors under a separate [Independent Contractor Agreement](/independent-contractor-agreement), which governs your contractor status.",
            "You control the manner and means of performing services, subject to agreed deliverables, brand standards, safety requirements, legal requirements, and activation timing.",
            "You are free to accept or decline any activation opportunity and to provide similar services to other companies, including Ignite's competitors.",
            "You are solely responsible for your own taxes and for compliance with applicable tax, labor, licensing, and regulatory obligations. Ignite does not withhold taxes and will issue IRS Form 1099 or equivalent tax forms as applicable.",
            "You are not eligible for employee benefits, including paid time off, health insurance, retirement benefits, unemployment insurance, workers' compensation, or overtime.",
          ],
        },
        {
          id: "location",
          number: "29",
          title: "Location services and GPS data",
          body: [
            { h: "29.1 Location permission is required for timekeeping", id: "location-required" },
            "Clock-in and clock-out features generally require location services on your device, and location verification is a condition of participating in assignments that require it. If you decline location permission, you may be unable to use those features or accept those assignments, and time recorded without location may require additional review before it is approved.",
            { h: "29.2 Collection during scheduled activations", id: "location-collection" },
            "When you clock in for a scheduled activation, the Platform collects precise GPS coordinates from your device. In the mobile app, location is collected periodically during the activation window (currently about every two minutes, or when you move a meaningful distance). Through the web check-in page, location is collected when you clock in and when you clock out. Location data is used to:",
            {
              list: [
                "verify your presence at the assigned event or activation location;",
                "prevent timekeeping fraud and confirm completion for payment;",
                "provide real-time field reporting to Ignite and, as described in the Privacy Policy, to Clients; and",
                "support compliance with venue, contractual, and regulatory requirements.",
              ],
            },
            "Location collection runs only during the scheduled activation window. If you do not clock out, collection automatically stops fifteen (15) minutes after the scheduled end time.",
            { h: "29.3 Mileage tracking", id: "mileage" },
            "If an assignment offers mileage reimbursement and you turn on mileage tracking, the Platform records your location while the trip is active (in the mobile app, a series of points along your route; on the web, your starting and ending location) to calculate reimbursable distance. Mileage tracking runs only while you have it turned on for that trip.",
            { h: "29.4 No off-activation tracking", id: "no-off-activation" },
            "The Platform does not collect your location outside of scheduled activation windows and active mileage trips, and Ignite does not sell location data.",
            { h: "29.5 Device authorization", id: "device" },
            "You represent that you are authorized to enable location services on the device you use to access the Platform.",
          ],
        },
        {
          id: "compensation",
          number: "30",
          title: "Compensation, completion, and payment",
          body: [
            { h: "30.1 Activation fee structure", id: "activation-fee" },
            'Each activation opportunity provides a flat "Activation Fee" payable upon successful completion of the activation responsibilities and required deliverables. Compensation is project-based and is not hourly, wage-based, or time-based. The Activation Fee for each engagement is set in the activation posting.',
            'Payment is conditioned on submission of the required post-event recap and proof-of-performance ("POP") materials. Ignite may withhold payment until complete recap materials and deliverables are received.',
            { h: "30.2 Completion-based compensation", id: "completion" },
            "Compensation eligibility is based on overall fulfillment of the scheduled activation window and required deliverables, not merely time present. Partial completion may result in reduced compensation under Ignite's Activation Completion Policy, which is incorporated by reference and sets tiered thresholds based on the percentage of the activation window completed and deliverables submitted. Specific tiers are defined in the Independent Contractor Agreement and the Activation Completion Policy.",
            "Minor deviations of up to ten (10) minutes from the scheduled activation window will not, by themselves, reduce compensation eligibility.",
            { h: "30.3 Overage compensation and activation extensions", id: "overage" },
            'If an activation extends beyond the scheduled window at a Client\'s request or for operational necessity, you may be eligible for supplemental compensation ("Overage Compensation"). Overage time is measured in fifteen (15) minute increments, rounded to the nearest increment, at the Overage Rate specified in the activation posting. Overage Compensation applies only to time approved by Ignite during or promptly after the activation, and Ignite may deny it for time that was not approved, not required by Client direction, or not supported by activation records. Overage Compensation is a supplemental project-based adjustment and does not convert the Activation Fee into hourly wages, overtime, or employee compensation.',
            { h: "30.4 Early termination outside your control", id: "early-termination" },
            "If an activation ends early for reasons outside your control (including venue closure, weather, safety concerns, government order, or Client cancellation on site), you will receive the full Activation Fee, provided you were present and prepared to perform.",
            { h: "30.5 Cancellation, delay, and rescheduling", id: "cancellation" },
            "Activations may be canceled, delayed, shortened, or rescheduled due to Client direction, venue decisions, product availability, weather, safety concerns, force majeure, or other circumstances. Unless otherwise agreed in writing:",
            {
              list: [
                "Ignite has no obligation to pay for activations canceled before services begin;",
                "Ignite has no obligation to pay for delays before services begin;",
                "you are not entitled to lost opportunity, expectation, or similar damages arising from cancellation, delay, or rescheduling; and",
                "if services have not begun, no Activation Fee is owed.",
              ],
            },
            "If cancellation occurs after you have begun services, compensation is determined under Section 30.2 or Section 30.4, as applicable.",
            { h: "30.6 Client nonpayment and payment delay", id: "client-nonpayment" },
            "Ignite may depend on receiving payment from its Clients. If a Client has not paid Ignite for an activation, Ignite may delay your payment for up to sixty (60) days after Ignite receives your complete POP materials and documentation, and will use commercially reasonable efforts to collect from the Client.",
            { h: "30.7 How you are paid", id: "payment-provider" },
            "Ignite pays Ambassadors through a third-party payment provider, currently Wingspan. You must create and maintain an account with the payment provider, provide accurate tax and payout information to it, and accept its terms. The payment provider collects your bank and tax details directly. Ignite is not responsible for delays or errors caused by the payment provider or by inaccurate information you provide.",
            { h: "30.8 Expenses, mileage, and travel", id: "expenses" },
            "You are responsible for your own expenses unless Ignite pre-approves specific reimbursable expenses in writing. Mileage reimbursement, if offered, requires advance approval and is paid only for approved travel in accordance with Ignite's reimbursement instructions, including required receipts or mileage records. Travel time is not compensable unless the activation posting says so.",
            { h: "30.9 Fraudulent documentation", id: "fraud" },
            "Ignite may withhold or deny payment for any activation if POP materials, receipts, photos, location data, or other documentation are materially false, misleading, fabricated, or not from the activation, and may require repayment of amounts paid based on fraudulent documentation, to the maximum extent permitted by law.",
          ],
        },
        {
          id: "property",
          number: "31",
          title: "Company property and corporate card",
          body: [
            { h: "31.1 Company property", id: "company-property" },
            'You agree to keep in good condition any product, accessories, apparel, equipment, devices, signage, training materials, or other property provided by Ignite or its Client ("Company Property"), and to return it on request, at the end of an assignment, or upon a performance default. Unless Ignite agrees otherwise in writing, you must return all Company Property within seven (7) days of the default or request date, using Ignite\'s prepaid shipping label if provided. If you do not, Ignite may withhold or offset amounts owed to you, seek return of the property or its value, and seek reimbursement of reasonable recovery costs, to the maximum extent permitted by law.',
            { h: "31.2 Company-issued credit card", id: "company-card" },
            'If Ignite issues you a corporate credit card ("Company Card"):',
            {
              list: [
                "Authorized use only. Use it only for pre-approved, assignment-related purchases expressly authorized by Ignite in writing.",
                "Receipts required. Submit original itemized receipts for all purchases within forty-eight (48) hours of the event or transaction, whichever comes first, clearly showing the vendor, amount, date, and nature of the expense. Late or incomplete receipts may result in the amount being treated as unauthorized.",
                "Unauthorized charges. Non-approved purchases, personal use, or spending above the authorized amount without prior written consent is a breach of these Terms, and Ignite may withhold the full amount of unauthorized or unsubstantiated charges from your compensation to the maximum extent permitted by law.",
                "Lost or stolen card. Notify Ignite immediately if a Company Card is lost, stolen, or compromised.",
              ],
            },
          ],
        },
        {
          id: "conduct",
          number: "32",
          title: "Conduct, compliance, and removal",
          body: [
            { h: "32.1 Age verification and responsible sampling", id: "age-verification" },
            "On any assignment involving alcohol, hemp-derived THC, cannabis, nicotine, or another age-restricted product, you must follow the program's age-verification procedure and all applicable laws, retailer rules, and responsible-service limits. Never offer an age-restricted product to anyone under the legal age, anyone who cannot show valid identification when the program requires it, or anyone who appears intoxicated, and never exceed the serving limits you are given.",
            { h: "32.2 No alcohol or drug use", id: "no-alcohol" },
            "You will not consume alcohol or any intoxicating product, or be impaired, during an assignment or while representing Ignite or its Clients. Ignite or the Client may require your immediate removal for suspected impairment or violation of sampling requirements.",
            { h: "32.3 Product claims", id: "product-claims" },
            "Use only the product information and talking points the program provides. Do not make health, medical, potency, or comparative claims that you were not given, and do not make promises about pricing or offers.",
            { h: "32.4 Professional conduct", id: "professional-conduct" },
            "You will behave professionally and refrain from unlawful discrimination, harassment, illegal drug use, unsafe conduct, or misconduct.",
            { h: "32.5 Removal", id: "removal" },
            "Ignite or the Client may require your immediate removal from an assignment for noncompliance, safety concerns, misconduct, or poor performance. If removed for cause, you may be paid only for services performed through removal, subject to applicable law.",
            { h: "32.6 Background checks and credentialing", id: "credentialing" },
            "Certain assignments may require background checks, identity verification, security credentialing, or venue or Client onboarding. You agree to cooperate with these requirements, which will be conducted in compliance with applicable law and with any notice and consent the law requires, as a condition of performing those assignments. If you do not complete or pass a required check, you may be removed from the assignment.",
            { h: "32.7 Medical emergency authorization", id: "medical" },
            "In a medical emergency involving you or anyone at an assignment, you authorize Ignite, the Client, venue personnel, or event staff to contact emergency services and take reasonable actions to secure emergency assistance. You are responsible for your own medical care and expenses, to the maximum extent permitted by law, and you release Ignite and its Clients from liability for actions taken in good faith to obtain emergency assistance, except to the extent caused by their gross negligence or willful misconduct.",
          ],
        },
        {
          id: "vehicle",
          number: "33",
          title: "Vehicle use, insurance, and safety",
          body: [
            "If you use a personal vehicle in connection with services, you do so as an independent contractor. Ignite does not direct or control your operation of any vehicle and does not assume responsibility or liability for your vehicle use.",
            "You assume all risk and responsibility for the operation, maintenance, condition, and use of any vehicle you use, including accidents, injuries, damages, citations, fines, towing, impound, and insurance claims.",
            "You represent that you maintain at all times a valid driver's license and legally required automobile liability insurance with limits sufficient to cover your vehicle-related risks.",
            "You will indemnify, defend, and hold harmless Ignite and its Clients from all claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of or relating to your vehicle use in connection with services.",
            "Reimbursement of mileage, parking, or other vehicle expenses does not change your independent contractor status or make Ignite responsible for your vehicle use. Do not use the Platform while driving.",
            "You may not transport other contractors, Client personnel, or attendees as part of the services without Ignite's prior written approval.",
            "You will follow all safety rules, venue policies, and reasonable safety instructions.",
          ],
        },
        {
          id: "likeness",
          number: "34",
          title: "Likeness, social media, and authority",
          body: [
            { h: "34.1 Media release", id: "media-release" },
            "You grant Ignite and its Clients the right to use your name, likeness, voice, and images and recordings from events for marketing, promotional, reporting, and internal documentation purposes, without further compensation unless prohibited by law.",
            { h: "34.2 Social media", id: "social-media" },
            "You may not present yourself as an official spokesperson for Ignite or a Client and may not post event-related content unless authorized by Ignite or the Client. If you post permitted content about an assignment, Ignite, or a Client, you must comply with advertising and endorsement laws, including Federal Trade Commission disclosure requirements, and clearly disclose your material connection (for example, #ad).",
            { h: "34.3 No authority to bind", id: "no-authority" },
            "You have no authority to bind Ignite or its Clients and will not make commitments, offers, pricing promises, or representations on their behalf.",
            { h: "34.4 Client marks", id: "client-marks" },
            "Except as expressly authorized in writing for an assignment, you may not use, reproduce, display, or publish any Ignite or Client trademarks, logos, brand names, slogans, copyrighted materials, or other brand assets, including in any portfolio, resume, website, social media post, or advertisement. All goodwill from permitted use belongs to Ignite or the Client.",
          ],
        },
        {
          id: "ambassador-confidentiality",
          number: "35",
          title: "Confidential information and consumer data",
          body: [
            "Through assignments you may learn confidential information belonging to Ignite or its Clients, including Client identities, campaign strategies, pricing, product launches, event logistics, consumer data, training materials, vendor lists, processes, credentials, and Platform technology. In addition to Section 14, you agree to:",
            {
              list: [
                "keep that information strictly confidential and use it only to perform your assignments;",
                "collect, store, and transmit consumer or attendee information only through the Platform or other Ignite-approved methods;",
                "not keep consumer information on your personal devices or accounts longer than one (1) day after the event unless required for deliverables;",
                "not sell, share, or use consumer or attendee information for any personal purpose; and",
                "notify Ignite immediately of any suspected data breach, unauthorized access, or loss of data.",
              ],
            },
          ],
        },
        {
          id: "work-product",
          number: "36",
          title: "Photos, recaps, and work product",
          body: [
            "Photos, videos, recaps, and other materials you create during assignments are work product governed by your Independent Contractor Agreement, under which you assign your rights in them to Ignite so that Ignite can deliver them to its Clients. To the extent any rights are not assigned, you grant Ignite and its Clients a perpetual, irrevocable, worldwide, royalty-free, transferable, and sublicensable license to use them for any purpose related to the assignment, the Platform, and their business.",
            "Take only the photos the program asks for. Do not photograph minors, do not take close-up photos of an identifiable consumer or of anyone's ID document unless the program requires it and the person agrees, and follow any retailer or venue photo rules.",
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "part-d",
      label: "Part D",
      title: "General legal terms",
      appliesTo: "Applies to everyone.",
      sections: [
        {
          id: "disclaimers",
          number: "37",
          title: "Disclaimers",
          body: [
            {
              caps: "EXCEPT AS EXPRESSLY STATED IN AN ORDER, THE PLATFORM, AI FEATURES, AND ALL CONTENT AND OUTPUTS ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE,\" AND IGNITE DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ACCURACY, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.",
            },
            {
              caps: "IGNITE DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, THAT DATA WILL NOT BE LOST, OR THAT AI OUTPUTS, METRICS, OR REPORTS WILL BE ACCURATE OR COMPLETE. IGNITE DOES NOT GUARANTEE ANY SALES, CONVERSIONS, OR CAMPAIGN RESULTS.",
            },
            "Ignite uses commercially reasonable safeguards, but no system is completely secure. Some jurisdictions do not allow certain warranty exclusions, so some of these exclusions may not apply to you; in that case, warranties are limited to the minimum extent and duration permitted by law.",
          ],
        },
        {
          id: "limitation-of-liability",
          number: "38",
          title: "Exclusion of certain damages",
          body: [
            {
              caps: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, AND EXCEPT FOR EXCLUDED CLAIMS (DEFINED IN SECTION 39), NEITHER IGNITE NOR ITS MEMBERS, OFFICERS, EMPLOYEES, CONTRACTORS, AFFILIATES, SERVICE PROVIDERS, OR LICENSORS WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, SALES, BUSINESS, GOODWILL, OR DATA, OR COSTS OF SUBSTITUTE SERVICES, ARISING OUT OF OR RELATING TO THESE TERMS OR THE PLATFORM, HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, EVEN IF ADVISED OF THEIR POSSIBILITY.",
            },
          ],
        },
        {
          id: "liability-cap",
          number: "39",
          title: "Limitation of liability",
          body: [
            {
              caps: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, AND EXCEPT FOR EXCLUDED CLAIMS, IGNITE'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS, ANY ORDER, AND THE PLATFORM WILL NOT EXCEED: (A) FOR A CLIENT, THE FEES PAID BY THE CLIENT TO IGNITE UNDER THE APPLICABLE ORDER DURING THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM; AND (B) FOR ANY OTHER USER, ONE HUNDRED U.S. DOLLARS (US $100).",
            },
            '"Excluded Claims" means (a) a party\'s indemnification obligations; (b) a party\'s liability for gross negligence, fraud, or willful misconduct; (c) a Client\'s obligation to pay fees; (d) a party\'s breach of Section 14 (Confidentiality), excluding Ignite\'s liability for security incidents, which is subject to the cap in clause (A); (e) a Client\'s breach of Sections 6, 7, 22, or 23; and (f) any liability that cannot be limited under applicable law.',
            "This Section does not limit Ignite's obligation to pay an Ambassador fees earned for completed activations under the Independent Contractor Agreement. These limitations are an essential part of the bargain between the parties and apply even if a remedy fails of its essential purpose.",
          ],
        },
        {
          id: "user-indemnity",
          number: "40",
          title: "Indemnification by users",
          body: [
            "In addition to any indemnity in Part B or Part C, you will indemnify, defend, and hold harmless Ignite and its members, officers, employees, contractors, affiliates, and licensors from and against all third-party claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: your use of the Platform in violation of these Terms; your violation of law or of any third party's rights; your User Content; your negligence, willful misconduct, or fraud; or your breach of confidentiality obligations.",
          ],
        },
        {
          id: "disputes",
          number: "41",
          title: "Dispute resolution, arbitration, and class action waiver",
          body: [
            { h: "41.1 Informal resolution first", id: "informal-resolution" },
            "Before starting any arbitration or court proceeding, the party with a dispute must send the other a written notice describing the dispute and the relief sought, and the parties will try in good faith to resolve it informally for at least thirty (30) days. Notices to Ignite go to " +
              LEGAL_EMAIL +
              ".",
            { h: "41.2 Binding arbitration", id: "arbitration" },
            {
              caps: "EXCEPT AS PROVIDED IN SECTION 41.4, ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS, ANY ORDER, OR THE PLATFORM WILL BE RESOLVED BY FINAL AND BINDING ARBITRATION ADMINISTERED BY THE AMERICAN ARBITRATION ASSOCIATION (\"AAA\") UNDER ITS COMMERCIAL ARBITRATION RULES, BEFORE A SINGLE ARBITRATOR.",
            },
            "For disputes between Ignite and a Client, the arbitration will take place in Washoe County, Nevada, unless the parties agree otherwise. For disputes with an Ambassador or other individual user, the arbitration will take place in the county where the individual lives or performed services, or by video conference, and Ignite will pay the AAA filing, administration, and arbitrator fees beyond what the individual would pay to file in court, where required by the AAA's rules or applicable law. The Federal Arbitration Act governs this agreement to arbitrate. The arbitrator's award is final, and judgment may be entered in any court of competent jurisdiction. For Ambassadors, the dispute resolution terms of the Independent Contractor Agreement control if they conflict with this Section.",
            { h: "41.3 Class action waiver", id: "class-waiver" },
            {
              caps: "ALL CLAIMS MUST BE BROUGHT IN A PARTY'S INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE CLAIMS OF MORE THAN ONE PERSON OR PRESIDE OVER ANY FORM OF CLASS OR REPRESENTATIVE PROCEEDING. IF THIS CLASS ACTION WAIVER IS FOUND UNENFORCEABLE AS TO A CLAIM, THAT CLAIM WILL PROCEED IN COURT, NOT IN ARBITRATION.",
            },
            { h: "41.4 Exceptions", id: "arbitration-exceptions" },
            "Either party may bring an individual claim in small claims court, and either party may seek temporary, preliminary, or permanent injunctive relief in court to protect its intellectual property, Confidential Information, or data, or to stop a violation of Sections 6, 7, 22, or 23.",
            { h: "41.5 Opt-out for individuals", id: "arbitration-opt-out" },
            "If you are an individual, you may opt out of this agreement to arbitrate by emailing " +
              LEGAL_EMAIL +
              ' within thirty (30) days after you first accept these Terms, with the subject line "Arbitration opt-out" and your name and the email or phone number on your account. Opting out does not affect any other part of these Terms.',
          ],
        },
        {
          id: "governing-law",
          number: "42",
          title: "Governing law and venue",
          body: [
            "These Terms and any dispute arising out of or relating to them or the Platform are governed by the laws of the State of Nevada, without regard to its conflict-of-laws rules, and by applicable U.S. federal law. The United Nations Convention on Contracts for the International Sale of Goods does not apply.",
            "For any matter that is not subject to arbitration, or to enforce an arbitration award, the parties consent to the exclusive jurisdiction and venue of the state and federal courts located in Washoe County, Nevada, except that an Ambassador or other individual may bring a permitted court claim in the courts of the county where they live.",
          ],
        },
        {
          id: "export",
          number: "43",
          title: "Export controls and sanctions",
          body: [
            "The Platform is intended for use in the United States. You may not use, export, or re-export the Platform in violation of U.S. export control or sanctions laws, or permit access by anyone located in a comprehensively sanctioned country or region or identified on a U.S. government restricted-party list. You represent that you are not such a person.",
          ],
        },
        {
          id: "changes",
          number: "44",
          title: "Changes to these Terms",
          body: [
            "We may update these Terms from time to time. We will post the updated Terms with a new \"last updated\" date and, for material changes, give reasonable advance notice through the Platform, by email, or by other reasonable means. Changes apply going forward and take effect on the date stated in the notice (at least fifteen (15) days after notice for material changes, unless the change is required by law or addresses security or abuse).",
            "If you continue to use the Platform after changes take effect, you accept them. If you do not agree, you must stop using the Platform. For Clients with an Order, changes that materially reduce the Client's rights during a paid term take effect at renewal unless the Client agrees sooner. Disputes are governed by the version of these Terms in effect when the dispute arose.",
          ],
        },
        {
          id: "notices",
          number: "45",
          title: "Notices",
          body: [
            "Ignite may give you notices through the Platform, by email to the address on your account, or by text message where appropriate. Notices to Ignite must be sent by email to " +
              LEGAL_EMAIL +
              ' with "Legal notice" in the subject line; Ignite will provide a mailing address for formal legal process on request. Notices are effective when received, and email notices are received on the next business day after sending unless the sender receives a delivery failure.',
          ],
        },
        {
          id: "assignment",
          number: "46",
          title: "Assignment",
          body: [
            "You may not assign or transfer these Terms or any Order, by operation of law or otherwise, without Ignite's prior written consent. Ignite may assign these Terms and any Order without consent to an affiliate or in connection with a merger, acquisition, reorganization, or sale of all or substantially all of the assets or business to which they relate. Any prohibited assignment is void. These Terms bind and benefit the parties' permitted successors and assigns.",
          ],
        },
        {
          id: "entire-agreement",
          number: "47",
          title: "Entire agreement and order of precedence",
          body: [
            "These Terms, together with the Privacy Policy, Acceptable Use Policy, Data Processing Summary, any Order, and, for Ambassadors, the Independent Contractor Agreement and Activation Completion Policy, are the entire agreement between you and Ignite about the Platform and supersede all prior or contemporaneous agreements and understandings on that subject.",
            "If documents conflict, the following order controls: (1) a signed Order or master services agreement, but only for the specific conflicting term and the parties to it; (2) for Ambassadors, the Independent Contractor Agreement and Activation Completion Policy; (3) the Data Processing Summary or a signed data processing agreement, for data protection matters; (4) these Terms; (5) the Acceptable Use Policy; and (6) the Privacy Policy. Terms in a Client purchase order, vendor portal, or similar document are void even if Ignite accepts or signs the document, unless Ignite expressly agrees to them in a signed writing that references these Terms.",
          ],
        },
        {
          id: "force-majeure",
          number: "48",
          title: "Force majeure",
          body: [
            "Neither party is liable for failure or delay in performing obligations (other than payment obligations) caused by events beyond its reasonable control, including natural disasters, severe weather, epidemics, government action, war, terrorism, civil unrest, labor disputes, venue or retailer closures, product shortages or recalls not caused by Ignite, utility, internet, or hosting failures, and cyberattacks not caused by the affected party's failure to use reasonable safeguards.",
          ],
        },
        {
          id: "general",
          number: "49",
          title: "General",
          body: [
            "Severability. If any provision of these Terms is held invalid or unenforceable, it will be enforced to the maximum extent permissible and the remaining provisions will remain in full force.",
            "No waiver. A failure or delay in enforcing any right is not a waiver of it.",
            "Relationship. The parties are independent contractors. Nothing in these Terms creates a partnership, franchise, joint venture, agency, fiduciary, or employment relationship.",
            "No third-party beneficiaries. There are no third-party beneficiaries of these Terms, except that Ignite's personnel, contractors, and Clients may enforce the indemnities and releases that expressly protect them.",
            'Interpretation. Headings are for convenience only. "Including" means "including without limitation." These Terms will not be construed against the drafter.',
            "Electronic agreement. You agree that these Terms may be accepted electronically and that electronic records and notices satisfy any requirement that they be in writing.",
            "Accessibility. Ignite is committed to making the Platform accessible to people with disabilities and works toward substantial conformance with WCAG 2.1 Level AA where reasonably practicable. If you encounter a barrier, contact us and we will work to provide assistance or an accommodation.",
            "Mobile apps. If you download a Spark mobile app from Apple's App Store or Google Play, these Terms are between you and Ignite, not the app store operator, which has no responsibility for the app or its support, and you must also comply with the app store's terms of use. Apple and its subsidiaries are third-party beneficiaries of these Terms for the purpose of enforcing them against you with respect to the iOS app.",
          ],
        },
        {
          id: "contact",
          number: "50",
          title: "Contact",
          body: [
            "Questions about these Terms can be sent to:",
            { list: LEGAL_CONTACT_LINES },
          ],
        },
      ],
    },
  ],
};
