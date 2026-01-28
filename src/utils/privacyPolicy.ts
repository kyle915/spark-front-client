export const privacyPolicy = {
  title: "Privacy Policy",
  platform: "Spark",
  company: "Ignite Productions",
  website: "https://www.igniteproductions.co",
  introduction:
    'Spark is a digital platform operated by Ignite Productions, a veteran-owned event staffing agency specializing in brand ambassador services and marketing activations across the United States. We respect your privacy and are committed to protecting the personal information you share with us through this platform and related websites. This Privacy Policy explains how information is collected, used, disclosed, and safeguarded when you access or interact with Spark.',

  sections: [
    {
      id: "information_we_collect",
      title: "Information We Collect",
      content: {
        personal_information: [
          "Full name",
          "Email address",
          "Phone number",
          "Company name",
          "Profile, staffing, availability, or application-related information"
        ],
        automatically_collected_information: [
          "IP address",
          "Device and browser information",
          "Operating system",
          "Pages viewed and interaction data"
        ]
      }
    },

    {
      id: "legal_basis_gdpr",
      title: "Legal Basis for Processing (GDPR)",
      content: [
        "Performance of a contract or to take steps prior to entering into a contract",
        "Legitimate business interests related to staffing operations and platform improvement",
        "Compliance with legal obligations",
        "Consent, where explicitly obtained"
      ]
    },

    {
      id: "how_we_use_information",
      title: "How We Use Your Information",
      content: [
        "Operate, manage, and maintain the Spark platform",
        "Respond to inquiries related to event staffing, brand ambassador services, and marketing activations",
        "Evaluate, manage, and coordinate staffing applications, availability, and assignments",
        "Communicate regarding campaigns, schedules, confirmations, payments, or service updates",
        "Improve platform functionality, services, and user experience",
        "Analyze usage trends and platform performance",
        "Comply with legal, contractual, and regulatory obligations"
      ]
    },

    {
      id: "cookies",
      title: "Cookies and Tracking Technologies",
      content:
        "Spark may use cookies and similar tracking technologies to ensure proper platform functionality, enhance user experience, and analyze traffic. Where required by law, cookie consent will be obtained. You may disable cookies through your browser settings; however, some features of the platform may not function as intended."
    },

    {
      id: "disclosure",
      title: "Disclosure of Your Information",
      content: [
        "We do not sell personal information",
        "We do not share personal information for cross-context behavioral advertising",
        "We may share information with Ignite Productions and its clients strictly as necessary to deliver event staffing and marketing activation services",
        "We may share information with trusted vendors or service providers under confidentiality obligations",
        "We may disclose information when required by law, regulation, subpoena, or legal process",
        "We may disclose information to protect the rights, property, or safety of Spark, Ignite Productions, users, clients, or others"
      ]
    },

    {
      id: "data_retention",
      title: "Data Retention",
      content:
        "Personal information is retained only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law."
    },

    {
      id: "data_security",
      title: "Data Security",
      content:
        "We implement reasonable administrative, technical, and physical safeguards designed to protect your personal information. However, no method of transmission over the Internet or electronic storage is completely secure."
    },

    {
      id: "gdpr_rights",
      title: "Your Rights Under GDPR",
      content: [
        "Right to access your personal data",
        "Right to rectification of inaccurate data",
        "Right to erasure (right to be forgotten)",
        "Right to restriction of processing",
        "Right to data portability",
        "Right to object to processing",
        "Right to withdraw consent at any time",
        "Right to lodge a complaint with a supervisory authority"
      ]
    },

    {
      id: "california_privacy_rights",
      title: "California Privacy Rights (CCPA / CPRA)",
      content: [
        "Right to know what personal information is collected, used, disclosed, or shared",
        "Right to request deletion of personal information",
        "Right to correct inaccurate personal information",
        "Right to opt out of the sale or sharing of personal information (if applicable)",
        "Right to limit the use of sensitive personal information (if applicable)",
        "Right to not receive discriminatory treatment for exercising privacy rights",
        "Requests will be responded to within 45 days, as required by law"
      ]
    },

    {
      id: "third_party_links",
      title: "Third-Party Links",
      content:
        "Spark may contain links to third-party websites or services. We are not responsible for the privacy practices or content of those third-party sites."
    },

    {
      id: "policy_changes",
      title: "Changes to This Privacy Policy",
      content:
        "We reserve the right to update this Privacy Policy at any time. Updates will be effective upon posting within the Spark platform."
    },

    {
      id: "contact",
      title: "Contact Us",
      content: {
        platform: "Spark",
        company: "Ignite Productions",
        website: "https://www.igniteproductions.co"
      }
    }
  ]
} as const;