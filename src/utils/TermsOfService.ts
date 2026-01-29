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
        "These Terms of Service (\"Terms\") govern access to and use of Spark (the \"Platform\"), which is operated by Ignite Productions (\"Ignite Productions\", \"we\", \"our\", or \"us\"). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, you may not use the Platform.",

    sections: [
        {
            id: "eligibility",
            title: "Eligibility",
            content: [
                "You must be at least 18 years old or the age of majority in your jurisdiction to use the Platform.",
                "By using the Platform, you represent and warrant that you have the legal capacity to enter into these Terms."
            ]
        },

        {
            id: "platform_purpose",
            title: "Platform Purpose",
            content:
                "Spark is a digital platform designed to support event staffing operations, including brand ambassador services and marketing activations across the United States."
        },

        {
            id: "account_registration",
            title: "Accounts and Registration",
            content: [
                "Certain features of the Platform may require you to create an account.",
                "You agree to provide accurate, current, and complete information and to keep your account information updated.",
                "You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted through your account.",
                "You must notify us immediately of any unauthorized use of your account."
            ]
        },

        {
            id: "acceptable_use",
            title: "Acceptable Use",
            content: [
                "You agree not to misuse the Platform or attempt to gain unauthorized access to systems or data.",
                "You agree not to use the Platform for unlawful, fraudulent, deceptive, or abusive purposes.",
                "You agree not to interfere with or disrupt the integrity, performance, or security of the Platform."
            ]
        },

        {
            id: "user_content",
            title: "User Submissions and Content",
            content: [
                "You may submit information or content through the Platform, including profile data, applications, availability, communications, and event-related details (\"User Content\").",
                "You represent and warrant that you own or have the necessary rights to submit User Content and that it does not violate applicable law or third-party rights.",
                "You grant Ignite Productions a non-exclusive, royalty-free, worldwide license to use, store, process, and display User Content solely for the purpose of operating and improving the Platform and providing staffing services."
            ]
        },

        {
            id: "staffing_relationships",
            title: "Staffing, Assignments, and Relationships",
            content: [
                "Spark may be used to facilitate staffing for marketing activations, product sampling, trade shows, guerrilla marketing, and related promotional events.",
                "Assignments, schedules, compensation, and availability are subject to change based on operational needs and client requirements.",
                "Nothing in these Terms creates an employment, agency, partnership, or joint venture relationship between you and Ignite Productions unless explicitly stated in a separate written agreement."
            ]
        },

        {
            id: "communications",
            title: "Communications",
            content: [
                "By using the Platform, you consent to receive operational communications related to campaigns, scheduling, confirmations, payments, and service updates.",
                "Communications may be delivered via email, SMS, phone calls, or in-platform notifications, in accordance with applicable law.",
                "You may opt out of non-essential communications where permitted by law."
            ]
        },

        {
            id: "privacy_and_data_protection",
            title: "Privacy and Data Protection",
            content: [
                "Your use of Spark is subject to our Privacy Policy, which describes how personal data is collected, used, and shared.",
                "We process personal data in accordance with applicable data protection laws, including the GDPR and the California Consumer Privacy Act (CCPA/CPRA), where applicable.",
                "You retain all rights granted to you under applicable privacy and data protection laws."
            ]
        },

        {
            id: "intellectual_property",
            title: "Intellectual Property",
            content: [
                "The Platform, including its software, design, branding, and content (excluding User Content), is owned by Ignite Productions or its licensors and is protected by intellectual property laws.",
                "You may not copy, modify, distribute, sell, lease, or reverse engineer any part of the Platform without prior written authorization."
            ]
        },

        {
            id: "third_party_services",
            title: "Third-Party Services",
            content:
                "The Platform may contain links to or integrations with third-party services. Ignite Productions does not control and is not responsible for third-party content, services, or privacy practices."
        },

        {
            id: "termination",
            title: "Termination",
            content: [
                "We may suspend or terminate your access to the Platform at any time if you violate these Terms or if required to protect the Platform, users, clients, or Ignite Productions.",
                "You may discontinue use of the Platform at any time.",
                "Provisions that by their nature should survive termination will survive, including intellectual property, disclaimers, limitation of liability, and indemnification."
            ]
        },

        {
            id: "changes",
            title: "Changes to These Terms",
            content:
                "We may update these Terms from time to time. Updated Terms become effective upon posting on the Platform. Continued use of the Platform constitutes acceptance of the revised Terms."
        },

        {
            id: "governing_law",
            title: "Governing Law and Venue",
            content:
                "These Terms are governed by the laws of the State where Ignite Productions is headquartered, without regard to conflict of laws principles. Any dispute shall be resolved exclusively in the state or federal courts located in that State, unless otherwise required by applicable law."
        },

        {
            id: "contact",
            title: "Contact Us",
            content:
                "If you have any questions about these Terms or your rights under applicable law, please contact us using the information below."
        }
    ],

    contact: {
        platform: "Spark",
        company: "Ignite Productions",
        website: "https://www.igniteproductions.co"
    },

    disclaimer:
        "These Terms of Service are provided for general informational purposes and do not constitute legal advice."
};