/**
 * Terms of Service (Spark)
 * NOTE: Replace placeholders like INSERT_DATE_HERE and INSERT_CONTACT_EMAIL before publishing.
 */

export type TermsSection = {
    id: string;
    title: string;
    content: string | string[];
};

export type TermsOfServiceDocument = {
    title: string;
    platform: string;
    operatedBy: string;
    scope: string;
    sections: TermsSection[];
    contact: {
        platform: string;
        company: string;
        website: string;
    };
    disclaimer: string;
};

export const termsOfService: TermsOfServiceDocument = {
    title: "Terms of Service",
    platform: "Spark",
    operatedBy: "Ignite Productions",
    scope:
        "These Terms of Service govern access to and use of Spark (the \"Platform\"), which is operated by Ignite Productions. By accessing or using the Platform, you agree to be bound by these Terms.",

    sections: [
        {
            id: "eligibility",
            title: "Eligibility",
            content: [
                "You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Platform.",
                "By using the Platform, you represent that you have the legal capacity to enter into these Terms."
            ]
        },
        {
            id: "platform_purpose",
            title: "Platform Purpose",
            content:
                "Spark is a platform that supports event staffing operations, including brand ambassador services and marketing activations across the United States."
        },
        {
            id: "account_registration",
            title: "3. Accounts and Registration",
            content: [
                "Some features may require you to create an account.",
                "You agree to provide accurate, current, and complete information and to keep your account information updated.",
                "You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account."
            ]
        },
        {
            id: "acceptable_use",
            title: "Acceptable Use",
            content: [
                "You agree not to misuse the Platform, including by attempting to gain unauthorized access to systems or data.",
                "You agree not to use the Platform for unlawful, fraudulent, or abusive purposes.",
                "You agree not to interfere with or disrupt the Platform or its normal operation."
            ]
        },
        {
            id: "user_content",
            title: "User Submissions and Content",
            content: [
                "You may provide content through the Platform (e.g., profile information, applications, availability, communications, or event-related details).",
                "You represent and warrant that you own or have the necessary rights to provide User Content and that it does not violate any law or third-party rights.",
            ]
        },
        {
            id: "staffing_relationships",
            title: "Staffing, Assignments, and Relationships",
            content: [
                "Spark may be used to facilitate staffing for marketing activations, product sampling, trade shows, guerrilla marketing, and related promotional events.",
                "Availability, scheduling, and assignment details may change based on operational needs, client requirements, and other factors.",
                "Nothing in these Terms creates an employment relationship between you and Ignite Productions unless explicitly agreed in a separate written agreement."
            ]
        },
        {
            id: "communications",
            title: "Communications",
            content: [
                "By using the Platform, you consent to receive communications from us related to operations, campaigns, scheduling, confirmations, and updates.",
                "Communications may be sent via email, SMS, phone, or in-platform notifications, depending on the information you provide and your settings."
            ]
        },
        {
            id: "privacy",
            title: "Privacy",
            content:
                "Your use of Spark is subject to our Privacy Policy. Please review the Privacy Policy to understand how we collect, use, and share information."
        },
        {
            id: "intellectual_property",
            title: "Intellectual Property",
            content: [
                "The Platform, including its software, design, branding, and content (excluding User Content), is owned by Ignite Productions or its licensors and is protected by applicable intellectual property laws.",
                "You may not copy, modify, distribute, sell, or lease any part of the Platform unless expressly permitted in writing."
            ]
        },
        {
            id: "third_party_services",
            title: "Third-Party Services",
            content:
                "The Platform may reference or link to third-party services or websites. We do not control and are not responsible for third-party content, policies, or practices."
        },
        {
            id: "termination",
            title: "Termination",
            content: [
                "We may suspend or terminate your access to the Platform at any time if we reasonably believe you have violated these Terms or if necessary to protect the Platform, users, clients, or Ignite Productions.",
                "You may stop using the Platform at any time.",
                "Upon termination, sections that by their nature should survive will survive (including intellectual property, disclaimers, limitation of liability, and indemnification)."
            ]
        },
        {
            id: "changes",
            title: "Changes to These Terms",
            content:
                "We may update these Terms from time to time. The updated Terms will be effective when posted on the Platform. Your continued use after changes become effective constitutes acceptance of the updated Terms."
        },
        {
            id: "governing_law",
            title: "Governing Law and Venue",
            content:
                "These Terms are governed by the laws of the State where Ignite Productions is headquartered, without regard to conflict of laws principles. Any dispute arising out of or relating to these Terms or the Platform shall be brought in the state or federal courts located in that State, unless applicable law provides otherwise."
        },
        {
            id: "contact",
            title: "Contact Us",
            content:
                "If you have any questions about these Terms, please contact us using the information below."
        }
    ],

    contact: {
        platform: "Spark",
        company: "Ignite Productions",
        website: "https://www.igniteproductions.co"
    },

    disclaimer:
        "This Terms of Service template is provided for general informational purposes and does not constitute legal advice."
};