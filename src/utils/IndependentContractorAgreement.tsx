import React, { useEffect, useState } from "react";

const agreementSections = [
  {
    id: "services",
    title: "1. Services; Activations",
    subsections: [
      { id: "services-1", title: "1.1 Engagement" },
      { id: "services-2", title: "1.2 Activation Postings" },
      { id: "services-3", title: "1.3 Acceptance Through Spark" },
      { id: "services-4", title: "1.4 Guidelines" },
      { id: "services-5", title: "1.5 No Guarantee of Work" },
      { id: "services-6", title: "1.6 Non-Exclusivity" },
      { id: "services-7", title: "1.7 Conflict Control" },
    ],
  },

  {
    id: "compensation",
    title: "2. Compensation; Deliverable-Based Pay",
    subsections: [
      { id: "compensation-1", title: "2.1 Activation Fee" },
      {
        id: "compensation-2",
        title: "2.2 Deliverable-Gated Compensation Tiers",
      },
      {
        id: "compensation-3",
        title: "2.3 Overage Compensation; Activation Extensions",
      },
      {
        id: "compensation-4",
        title: "2.4 Early Termination Outside Contractor Control",
      },
      { id: "compensation-5", title: "2.5 Cancellation; Delay; Rescheduling" },
      {
        id: "compensation-6",
        title: "2.6 Proof of Performance; Required Deliverables",
      },
      { id: "compensation-7", title: "2.7 Payment Timing" },
      { id: "compensation-8", title: "2.8 Client Nonpayment / Payment Delay" },
      { id: "compensation-9", title: "2.9 Expenses; Mileage; Travel" },
      { id: "compensation-10", title: "2.10 No Benefits" },
      { id: "compensation-11", title: "2.11 Fraudulent Documentation" },
      { id: "compensation-12", title: "2.12 Reimbursement for Purchases" },
    ],
  },

  {
    id: "contractor-status",
    title: "3. Independent Contractor Status",
    subsections: [
      { id: "contractor-status-1", title: "3.1 Independent Contractor" },
      { id: "contractor-status-2", title: "3.2 Control of Work" },
      { id: "contractor-status-3", title: "3.3 Non-Exclusivity" },
      { id: "contractor-status-4", title: "3.4 Tools and Equipment" },
      { id: "contractor-status-5", title: "3.5 Taxes" },
      { id: "contractor-status-6", title: "3.6 No Workers’ Compensation" },
      {
        id: "contractor-status-7",
        title: "3.7 No Subcontracting Without Consent",
      },
    ],
  },

  {
    id: "gps-platform",
    title: "4. GPS Verification; Platform Use",
    subsections: [
      { id: "gps-platform-1", title: "4.1 Spark Platform" },
      { id: "gps-platform-2", title: "4.2 GPS Location Verification" },
      { id: "gps-platform-3", title: "4.3 GPS Collection Windows" },
      { id: "gps-platform-4", title: "4.4 GPS Consent" },
      { id: "gps-platform-5", title: "4.5 No Employment Inference" },
    ],
  },

  {
    id: "term-force",
    title: "5. Term; Force Majeure",
    subsections: [
      { id: "term-force-1", title: "5.1 Term" },
      { id: "term-force-2", title: "5.2 Force Majeure" },
    ],
  },

  {
    id: "compliance-safety",
    title: "6. Compliance; Conduct; Eligibility; Safety",
    subsections: [
      { id: "compliance-safety-1", title: "6.1 Legal Compliance" },
      { id: "compliance-safety-2", title: "6.2 Eligibility to Work" },
      {
        id: "compliance-safety-3",
        title: "6.3 Certifications; Regulated Activities",
      },
      { id: "compliance-safety-4", title: "6.4 Alcohol Sampling Conduct" },
      { id: "compliance-safety-5", title: "6.5 Professional Conduct" },
      { id: "compliance-safety-6", title: "6.6 Removal" },
      {
        id: "compliance-safety-7",
        title: "6.7 Background Checks; Credentialing",
      },
      { id: "compliance-safety-8", title: "6.8 Safety Stop-Work Authority" },
      {
        id: "compliance-safety-9",
        title: "6.9 Medical Emergency Authorization",
      },
    ],
  },

  {
    id: "confidentiality",
    title: "7. Confidentiality; Data Privacy",
    subsections: [
      { id: "confidentiality-1", title: "7.1 Confidential Information" },
      { id: "confidentiality-2", title: "7.2 Non-Disclosure" },
      { id: "confidentiality-3", title: "7.3 Data & Privacy Requirements" },
      { id: "confidentiality-4", title: "7.4 Return/Destruction" },
      { id: "confidentiality-5", title: "7.5 Whistleblower / Legal Carve-Out" },
    ],
  },

  {
    id: "intellectual-property",
    title: "8. Intellectual Property; Work Product",
    subsections: [
      { id: "intellectual-property-1", title: "8.1 Work Product Defined" },
      { id: "intellectual-property-2", title: "8.2 Assignment of Rights" },
      { id: "intellectual-property-3", title: "8.3 Contractor Materials" },
      { id: "intellectual-property-4", title: "8.4 No Infringement" },
    ],
  },

  {
    id: "likeness-social",
    title: "9. Likeness; Social Media; No Authority",
    subsections: [
      { id: "likeness-social-1", title: "9.1 Media Release" },
      { id: "likeness-social-2", title: "9.2 Social Media" },
      { id: "likeness-social-3", title: "9.3 No Authority" },
      { id: "likeness-social-4", title: "9.4 FTC Compliance" },
      { id: "likeness-social-5", title: "9.5 Non-Use of Client Marks" },
    ],
  },

  {
    id: "non-solicitation",
    title: "10. Non-Solicitation; Non-Interference; Non-Disparagement",
    subsections: [
      {
        id: "non-solicitation-1",
        title: "10.1 Non-Solicitation of Ignite Personnel",
      },
      {
        id: "non-solicitation-2",
        title: "10.2 Non-Solicitation of Ignite Clients",
      },
      { id: "non-solicitation-3", title: "10.3 Non-Interference" },
      {
        id: "non-solicitation-4",
        title: "10.4 Confidential Information Restriction",
      },
      { id: "non-solicitation-5", title: "10.5 Non-Disparagement" },
    ],
  },

  {
    id: "termination",
    title: "11. Termination",
    subsections: [
      { id: "termination-1", title: "11.1 Termination by Either Party" },
      { id: "termination-2", title: "11.2 Termination for Cause" },
      { id: "termination-3", title: "11.3 Effect of Termination" },
      { id: "termination-4", title: "11.4 Survival" },
    ],
  },

  {
    id: "company-property",
    title: "12. Company Property; Corporate Card",
    subsections: [
      { id: "company-property-1", title: "12.1 Company Property" },
      {
        id: "company-property-2",
        title: "12.2 Return Upon Request or Default",
      },
      { id: "company-property-3", title: "12.3 Return Deadline" },
      { id: "company-property-4", title: "12.4 Failure to Return; Offset" },
      { id: "company-property-5", title: "12.5 Corporate Card" },
    ],
  },

  {
    id: "vehicle-insurance-liability",
    title:
      "13. Vehicle Use; Insurance; Indemnification; Limitation of Liability",
    subsections: [
      { id: "vehicle-1", title: "13.1 Vehicle Use" },
      { id: "vehicle-2", title: "13.2 Contractor Responsibility" },
      { id: "vehicle-3", title: "13.3 Required Insurance" },
      { id: "vehicle-4", title: "13.4 No Transporting Others" },
      { id: "vehicle-5", title: "13.5 Indemnification by Contractor" },
      { id: "vehicle-6", title: "13.6 Indemnification by Company" },
      { id: "vehicle-7", title: "13.7 Limitation of Liability" },
    ],
  },

  {
    id: "dispute-resolution",
    title: "14. Dispute Resolution; Arbitration",
    subsections: [
      { id: "dispute-1", title: "14.1 Good Faith Resolution" },
      { id: "dispute-2", title: "14.2 Binding Arbitration" },
      { id: "dispute-3", title: "14.3 Location" },
      { id: "dispute-4", title: "14.4 Class Action Waiver" },
      { id: "dispute-5", title: "14.5 Arbitration Opt-Out" },
    ],
  },

  {
    id: "general-provisions",
    title: "15. General Provisions",
    subsections: [
      { id: "general-1", title: "15.1 Entire Agreement" },
      { id: "general-2", title: "15.2 Amendments" },
      { id: "general-3", title: "15.3 Governing Law; Venue" },
      { id: "general-4", title: "15.4 Severability" },
      { id: "general-5", title: "15.5 Reformation / Blue-Pencil" },
      { id: "general-6", title: "15.6 Assignment" },
      { id: "general-7", title: "15.7 Notices" },
      { id: "general-8", title: "15.8 Electronic Signatures" },
    ],
  },

  {
    id: "california-addendum",
    title: "16. California Addendum",
    subsections: [],
  },
  {
    id: "massachusetts-addendum",
    title: "17. Massachusetts Addendum",
    subsections: [],
  },
  {
    id: "new-jersey-addendum",
    title: "18. New Jersey Addendum",
    subsections: [],
  },
  {
    id: "illinois-addendum",
    title: "19. Illinois / Chicago Addendum",
    subsections: [],
  },
  {
    id: "new-york-addendum",
    title: "20. New York / New York City Addendum",
    subsections: [],
  },
  {
    id: "washington-addendum",
    title: "21. Washington State Addendum",
    subsections: [],
  },
  { id: "oregon-addendum", title: "22. Oregon Addendum", subsections: [] },
  { id: "colorado-addendum", title: "23. Colorado Addendum", subsections: [] },
  {
    id: "connecticut-addendum",
    title: "24. Connecticut Addendum",
    subsections: [],
  },
  { id: "vermont-addendum", title: "25. Vermont Addendum", subsections: [] },
  {
    id: "minnesota-addendum",
    title: "26. Minnesota Addendum",
    subsections: [],
  },

  { id: "contact", title: "27. Contact Information", subsections: [] },
];

const scrollToId = (
  id: string,
  setActive: (id: string) => void,
  setManual: (v: boolean) => void,
) => {
  const el = document.getElementById(id);
  if (!el) return;

  setManual(true); // bloquea observer
  setActive(id); // highlight inmediato

  const yOffset = -90;
  const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;

  window.scrollTo({
    top: y,
    behavior: "smooth",
  });

  setTimeout(() => {
    setManual(false);
  }, 700);
};

const AgreementSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section
    id={id}
    className="scroll-mt-24 rounded-3xl border border-base-300 bg-base-100/90 shadow-sm backdrop-blur"
  >
    <div className="border-b border-base-300 px-6 py-5 sm:px-8">
      <h2 className="text-xl font-bold text-base-content sm:text-2xl">
        {title}
      </h2>
    </div>
    <div className="space-y-4 px-6 py-6 text-sm leading-7 text-base-content/80 sm:px-8 sm:text-base">
      {children}
    </div>
  </section>
);

const SubSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div
    id={id}
    className="scroll-mt-24 rounded-2xl border border-base-200 bg-base-200/40 p-4 sm:p-5"
  >
    <h3 className="mb-2 text-base font-semibold text-base-content sm:text-lg">
      {title}
    </h3>

    <div className="space-y-3 text-sm leading-7 text-base-content/80 sm:text-base">
      {children}
    </div>
  </div>
);

export default function IndependentContractorAgreementPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [manualScroll, setManualScroll] = useState(false);

  useEffect(() => {
    const elements = agreementSections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        if (manualScroll) return; // 🚨 ignora durante scroll manual

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-120px 0px -60% 0px",
        threshold: 0.3,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [manualScroll]);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
              <div className="border-b border-base-300 p-5">
                <div className="badge badge-primary badge-outline mb-3">
                  Spark by Ignite
                </div>
                <h1 className="text-xl font-bold leading-tight text-base-content">
                  Table of Contents
                </h1>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-4">
                <div className="space-y-4">
                  {agreementSections.map((section) => (
                    <div key={section.id}>
                      <button
                        onClick={() =>
                          scrollToId(
                            section.id,
                            setActiveSection,
                            setManualScroll,
                          )
                        }
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold leading-snug transition
                        ${
                          activeSection === section.id
                            ? "bg-primary text-primary-content"
                            : "text-base-content hover:bg-base-200"
                        }`}
                      >
                        {section.title}
                      </button>

                      {section.subsections?.length > 0 && (
                        <div className="mt-1 space-y-1 pl-4">
                          {section.subsections.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() =>
                                scrollToId(
                                  sub.id,
                                  setActiveSection,
                                  setManualScroll,
                                )
                              }
                              className={`w-full rounded-lg px-3 py-2 text-left text-xs leading-snug transition
                              ${
                                activeSection === sub.id
                                  ? "bg-base-300 text-base-content font-semibold"
                                  : "text-base-content/70 hover:bg-base-200"
                              }`}
                            >
                              {sub.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="hero overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-base-100 to-base-100 shadow-sm">
              <div className="hero-content w-full max-w-none px-6 py-10 sm:px-8 lg:px-10">
                <div className="w-full">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="badge badge-primary badge-outline mb-4">
                        Legal Document View
                      </div>
                      <h1 className="text-3xl font-black leading-tight text-base-content sm:text-4xl lg:text-5xl">
                        Ignite Productions LLC Independent Contractor Agreement
                      </h1>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-base-content/75 sm:text-base">
                        Effective Date: See Signature Block. This Agreement is
                        between Ignite Productions LLC, a Nevada limited
                        liability company and Veteran-Owned Small Business, and
                        the contractor whose name, contact information, and
                        signature appear in the signature block.
                      </p>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-base-content/75 sm:text-base">
                        By signing this Agreement or accepting an Activation
                        through the Spark by Ignite platform, the contractor
                        agrees to all terms below.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="alert border border-info/20 bg-info/10 text-sm leading-6 text-base-content">
              <span>
                This page is a structured web presentation of the Independent
                Contractor Agreement content for Spark by Ignite.
              </span>
            </div>

            <AgreementSection id="services" title="1. Services; Activations">
              <SubSection id="services-1" title="1.1 Engagement">
                <p>
                  The contractor will perform independent contractor services
                  for Ignite and/or Ignite’s clients, including event marketing,
                  brand ambassador services, sampling, demos, merchandising,
                  event setup/teardown, consumer engagement, reporting,
                  proof-of-performance documentation, and related activities.
                </p>
              </SubSection>

              <SubSection id="services-2" title="1.2 Activation Postings">
                <p>
                  Specific project-based engagements called Activations are
                  posted through Spark and may include dates, location,
                  activation window, duties, Activation Fee, Overage Rate,
                  deliverables and special requirements.
                </p>
              </SubSection>

              <SubSection id="services-3" title="1.3 Acceptance Through Spark">
                <p>
                  Acceptance requires review and acknowledgment of the
                  Activation Fee, deliverable requirements, completion tiers,
                  GPS verification requirements and Agreement terms through the
                  Platform workflow.
                </p>
              </SubSection>

              <SubSection id="services-4" title="1.4 Guidelines">
                <p>
                  The contractor agrees to comply with written or on-site
                  guidelines from Ignite and/or the client related to safety,
                  brand standards and event requirements.
                </p>
              </SubSection>

              <SubSection id="services-5" title="1.5 No Guarantee of Work">
                <p>
                  Ignite is not required to offer any minimum number of
                  Activations and the contractor is not required to accept any
                  Activation.
                </p>
              </SubSection>

              <SubSection id="services-6" title="1.6 Non-Exclusivity">
                <p>
                  This Agreement is non-exclusive. The contractor may perform
                  similar services for other companies including competitors.
                </p>
              </SubSection>

              <SubSection id="services-7" title="1.7 Conflict Control">
                <p>
                  If there is a conflict between this Agreement and an
                  Activation Posting, this Agreement controls unless the
                  Activation Posting explicitly overrides it.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="compensation"
              title="2. Compensation; Deliverable-Based Pay"
            >
              <SubSection id="compensation-1" title="2.1 Activation Fee">
                <p>
                  Each Activation provides a flat project-based fee for
                  successful completion and submission of deliverables.
                </p>
              </SubSection>

              <SubSection
                id="compensation-2"
                title="2.2 Deliverable-Gated Compensation Tiers"
              >
                <p>
                  Payout is determined by completion level and deliverable
                  submission.
                </p>
              </SubSection>

              <SubSection
                id="compensation-3"
                title="2.3 Overage Compensation; Activation Extensions"
              >
                <p>
                  Overage time begins after the scheduled Activation Window and
                  is calculated in fifteen-minute increments using the Overage
                  Rate specified in the posting.
                </p>
              </SubSection>

              <SubSection
                id="compensation-4"
                title="2.4 Early Termination Outside Contractor Control"
              >
                <p>
                  If an Activation ends early due to venue closure, weather or
                  safety issues, the contractor receives the full Activation Fee
                  if present and ready to perform.
                </p>
              </SubSection>

              <SubSection
                id="compensation-5"
                title="2.5 Cancellation; Delay; Rescheduling"
              >
                <p>
                  Ignite has no obligation to pay for Activations cancelled
                  before services begin.
                </p>
              </SubSection>

              <SubSection
                id="compensation-6"
                title="2.6 Proof of Performance; Required Deliverables"
              >
                <p>
                  Payment requires submission of proof-of-performance materials
                  and recap reports through Spark.
                </p>
              </SubSection>

              <SubSection id="compensation-7" title="2.7 Payment Timing">
                <p>
                  Ignite will pay within 30 days after receiving all required
                  deliverables unless otherwise required by law.
                </p>
              </SubSection>

              <SubSection
                id="compensation-8"
                title="2.8 Client Nonpayment / Payment Delay"
              >
                <p>
                  Payment may be delayed if the client has not yet paid Ignite.
                </p>
              </SubSection>

              <SubSection
                id="compensation-9"
                title="2.9 Expenses; Mileage; Travel"
              >
                <p>
                  Contractors are responsible for their own expenses unless
                  pre-approved.
                </p>
              </SubSection>

              <SubSection id="compensation-10" title="2.10 No Benefits">
                <p>Contractors are not eligible for employee benefits.</p>
              </SubSection>

              <SubSection
                id="compensation-11"
                title="2.11 Fraudulent Documentation"
              >
                <p>Ignite may deny payment for falsified documentation.</p>
              </SubSection>

              <SubSection
                id="compensation-12"
                title="2.12 Reimbursement for Purchases"
              >
                <p>
                  Approved purchases require original itemized receipts within
                  48 hours.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="contractor-status"
              title="3. Independent Contractor Status"
            >
              <SubSection
                id="contractor-status-1"
                title="3.1 Independent Contractor"
              >
                <p>
                  The contractor is an independent contractor and not an
                  employee, partner, joint venturer, agent, or legal
                  representative of Ignite. Nothing in this Agreement creates an
                  employment relationship between the contractor and Ignite.
                </p>
              </SubSection>

              <SubSection id="contractor-status-2" title="3.2 Control of Work">
                <p>
                  The contractor retains the right to control and direct the
                  manner and means of performing the Services, subject only to
                  agreed deliverables, activation timing, brand guidelines, and
                  safety requirements.
                </p>
              </SubSection>

              <SubSection id="contractor-status-3" title="3.3 Non-Exclusivity">
                <p>
                  The relationship is non-exclusive. The contractor is free to
                  perform services for other companies, including competitors of
                  Ignite.
                </p>
              </SubSection>

              <SubSection
                id="contractor-status-4"
                title="3.4 Tools and Equipment"
              >
                <p>
                  The contractor is responsible for providing their own tools,
                  equipment, transportation, and resources necessary to perform
                  the Services unless otherwise provided for a specific
                  Activation.
                </p>
              </SubSection>

              <SubSection id="contractor-status-5" title="3.5 Taxes">
                <p>
                  The contractor is solely responsible for all federal, state,
                  and local taxes arising from compensation received under this
                  Agreement. Ignite will issue IRS Form 1099 where applicable.
                </p>
              </SubSection>

              <SubSection
                id="contractor-status-6"
                title="3.6 No Workers’ Compensation"
              >
                <p>
                  The contractor is not covered by Ignite’s workers’
                  compensation or unemployment insurance except where required
                  by law.
                </p>
              </SubSection>

              <SubSection
                id="contractor-status-7"
                title="3.7 No Subcontracting Without Consent"
              >
                <p>
                  The contractor may not assign or subcontract the Services
                  without the prior written consent of Ignite.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="gps-platform"
              title="4. GPS Verification; Platform Use"
            >
              <SubSection id="gps-platform-1" title="4.1 Spark Platform">
                <p>
                  Services are coordinated, tracked, and documented through the
                  Spark by Ignite platform. The platform is used for accepting
                  Activations, clocking in and out of events, submitting
                  proof-of-performance materials, submitting post-event recap
                  reports, and completing other operational requirements
                  associated with Activations.
                </p>
              </SubSection>

              <SubSection
                id="gps-platform-2"
                title="4.2 GPS Location Verification"
              >
                <p>
                  Spark uses GPS location verification to confirm on-site
                  presence during Activations. GPS verification supports
                  accurate reporting, ensures completion of deliverables, and
                  confirms that the contractor was present at the activation
                  location during the scheduled Activation Window.
                </p>
              </SubSection>

              <SubSection
                id="gps-platform-3"
                title="4.3 GPS Collection Windows"
              >
                <ul className="list-disc ml-6 space-y-2">
                  <li>At clock-in</li>
                  <li>Periodically during the scheduled Activation Window</li>
                  <li>At clock-out</li>
                  <li>
                    For up to fifteen (15) minutes after the scheduled end time
                    if the contractor fails to clock out
                  </li>
                </ul>
                <p className="mt-3">
                  Spark does not collect GPS data outside the scheduled
                  Activation Window.
                </p>
              </SubSection>

              <SubSection id="gps-platform-4" title="4.4 GPS Consent">
                <p>
                  By accepting an Activation and enabling location services, the
                  contractor consents to the collection of precise GPS location
                  data as described in this Agreement and the Spark Privacy
                  Policy.
                </p>
              </SubSection>

              <SubSection
                id="gps-platform-5"
                title="4.5 No Employment Inference"
              >
                <p>
                  GPS verification is used solely for project verification and
                  does not create supervision or employment control over how
                  Services are performed.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection id="term-force" title="5. Term; Force Majeure">
              <SubSection id="term-force-1" title="5.1 Term">
                <p>
                  This Agreement begins on the Effective Date shown in the
                  signature block and continues until terminated in accordance
                  with Section 11 of this Agreement. Either party may terminate
                  the Agreement as described in the Termination provisions.
                </p>
              </SubSection>

              <SubSection id="term-force-2" title="5.2 Force Majeure">
                <p>
                  Neither party will be liable for failure or delay in
                  performing obligations under this Agreement if the failure or
                  delay results from events beyond the party’s reasonable
                  control.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>acts of God</li>
                  <li>severe weather</li>
                  <li>pandemics or public health emergencies</li>
                  <li>government orders or restrictions</li>
                  <li>venue closures</li>
                  <li>terrorism</li>
                  <li>civil unrest</li>
                  <li>labor disputes or strikes</li>
                  <li>product shipment failures</li>
                  <li>cyberattacks</li>
                  <li>other similar events beyond reasonable control</li>
                </ul>

                <p className="mt-3">
                  In the event of a force majeure event, the affected party will
                  use commercially reasonable efforts to resume performance as
                  soon as practicable.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="compliance-safety"
              title="6. Compliance; Conduct; Eligibility; Safety"
            >
              <SubSection id="compliance-safety-1" title="6.1 Legal Compliance">
                <p>
                  The contractor must comply with all applicable federal, state,
                  and local laws, regulations, and venue or client rules when
                  performing Services under this Agreement.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-2"
                title="6.2 Eligibility to Work"
              >
                <p>
                  The contractor represents and warrants that they are legally
                  eligible to perform Services in the jurisdiction where the
                  Activation takes place.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-3"
                title="6.3 Certifications; Regulated Activities"
              >
                <p>
                  Where regulated activities apply, including alcohol sampling
                  or similar activities, the contractor represents that they
                  hold and will maintain all permits, certifications, and
                  licenses required by applicable law.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-4"
                title="6.4 Alcohol Sampling Conduct"
              >
                <p>
                  If assigned to an Activation involving alcohol sampling, the
                  contractor may not consume alcohol or be intoxicated while
                  performing Services.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-5"
                title="6.5 Professional Conduct"
              >
                <p>
                  The contractor must maintain professional behavior at all
                  times during Activations.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>unlawful discrimination</li>
                  <li>harassment</li>
                  <li>intoxication</li>
                  <li>illegal drug use</li>
                  <li>unsafe behavior</li>
                  <li>misconduct toward clients, venue staff, or consumers</li>
                </ul>
              </SubSection>

              <SubSection id="compliance-safety-6" title="6.6 Removal">
                <p>
                  Ignite or the client may require the contractor to leave the
                  event location immediately if the contractor violates event
                  rules, safety requirements, or professional conduct
                  expectations.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-7"
                title="6.7 Background Checks; Credentialing"
              >
                <p>
                  Certain Activations may require background checks, identity
                  verification, or additional credentials depending on the
                  client, venue, or regulatory requirements.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-8"
                title="6.8 Safety Stop-Work Authority"
              >
                <p>
                  Ignite and/or the client may pause, modify, or immediately
                  stop Services if safety concerns arise or if conditions
                  present a risk to people, property, or the event.
                </p>
              </SubSection>

              <SubSection
                id="compliance-safety-9"
                title="6.9 Medical Emergency Authorization"
              >
                <p>
                  In the event of a medical emergency, the contractor authorizes
                  Ignite, the client, venue personnel, or event staff to contact
                  emergency services.
                </p>

                <p className="mt-3">
                  The contractor remains responsible for their own medical care
                  and expenses to the maximum extent permitted by law.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="confidentiality"
              title="7. Confidentiality; Data Privacy"
            >
              <SubSection
                id="confidentiality-1"
                title="7.1 Confidential Information"
              >
                <p>
                  Confidential Information includes all non-public information
                  relating to Ignite, its clients, and their brands.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>event details</li>
                  <li>pricing or budgets</li>
                  <li>marketing strategies</li>
                  <li>operational procedures</li>
                  <li>training materials</li>
                  <li>vendor lists</li>
                  <li>internal reports</li>
                  <li>passwords or credentials</li>
                  <li>consumer or attendee information</li>
                </ul>

                <p className="mt-3">
                  Confidential Information may exist in written, oral,
                  electronic, or other forms.
                </p>
              </SubSection>

              <SubSection id="confidentiality-2" title="7.2 Non-Disclosure">
                <p>
                  The contractor agrees not to disclose, use, copy, or
                  distribute Confidential Information except as necessary to
                  perform Services under this Agreement.
                </p>

                <p className="mt-3">
                  The contractor must use reasonable safeguards to protect
                  Confidential Information from unauthorized access or
                  disclosure.
                </p>
              </SubSection>

              <SubSection
                id="confidentiality-3"
                title="7.3 Data and Privacy Requirements"
              >
                <p>
                  If the contractor collects or interacts with consumer or
                  attendee data during an Activation:
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>
                    data may only be collected using Ignite-approved systems
                  </li>
                  <li>
                    data must only be used for the purposes of the Activation
                  </li>
                  <li>consumer data may not be sold or shared</li>
                  <li>consumer data may not be used for personal purposes</li>
                </ul>

                <p className="mt-3">
                  Unless required for deliverables, consumer data should not be
                  retained longer than one (1) day after the event.
                </p>
              </SubSection>

              <SubSection
                id="confidentiality-4"
                title="7.4 Return or Destruction of Confidential Information"
              >
                <p>
                  Upon request by Ignite or upon termination of this Agreement,
                  the contractor must return or permanently destroy all
                  Confidential Information in their possession.
                </p>

                <p className="mt-3">
                  This includes documents, files, notes, digital records, and
                  any copies of such materials.
                </p>
              </SubSection>

              <SubSection
                id="confidentiality-5"
                title="7.5 Whistleblower and Legal Disclosure Exception"
              >
                <p>
                  Nothing in this Agreement prevents the contractor from
                  reporting possible violations of law to a government agency,
                  cooperating with a government investigation, or making
                  disclosures protected by whistleblower laws.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="intellectual-property"
              title="8. Intellectual Property; Work Product"
            >
              <SubSection
                id="intellectual-property-1"
                title="8.1 Work Product Defined"
              >
                <p>
                  Work Product includes all deliverables, reports,
                  proof-of-performance materials, photographs, videos, written
                  content, lead lists, scripts, presentations, training
                  materials, notes, and any other materials created or developed
                  by the contractor in connection with the Services or an
                  Activation.
                </p>

                <p className="mt-3">
                  Work Product includes both tangible and intangible materials
                  and any intellectual property rights associated with such
                  materials.
                </p>
              </SubSection>

              <SubSection
                id="intellectual-property-2"
                title="8.2 Assignment of Rights"
              >
                <p>
                  The contractor irrevocably assigns to Ignite all right, title,
                  and interest in and to the Work Product, including all
                  copyrights, trademarks, trade secrets, and other intellectual
                  property rights.
                </p>

                <p className="mt-3">
                  To the extent any Work Product does not automatically qualify
                  as a work made for hire, the contractor agrees that such Work
                  Product is assigned to Ignite upon creation.
                </p>

                <p className="mt-3">
                  Ignite will have the exclusive right to use, modify,
                  reproduce, distribute, display, license, and create derivative
                  works from the Work Product worldwide.
                </p>
              </SubSection>

              <SubSection
                id="intellectual-property-3"
                title="8.3 Contractor Materials"
              >
                <p>
                  If the contractor incorporates any pre-existing materials,
                  templates, or intellectual property owned by the contractor
                  into the Work Product, the contractor grants Ignite a
                  perpetual, worldwide, royalty-free license to use, reproduce,
                  modify, distribute, and display those materials as
                  incorporated into the Work Product.
                </p>
              </SubSection>

              <SubSection
                id="intellectual-property-4"
                title="8.4 No Infringement"
              >
                <p>
                  The contractor represents and warrants that the Work Product
                  will not infringe upon the intellectual property rights of any
                  third party.
                </p>

                <p className="mt-3">
                  The contractor agrees not to incorporate third-party
                  copyrighted or proprietary materials into the Work Product
                  unless the contractor has obtained all necessary permissions
                  or licenses.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="likeness-social"
              title="9. Likeness; Social Media; No Authority"
            >
              <SubSection id="likeness-social-1" title="9.1 Media Release">
                <p>
                  The contractor grants Ignite and its clients the right to use
                  the contractor’s name, likeness, voice, image, and event
                  recordings for marketing, promotional, training, and internal
                  documentation purposes.
                </p>

                <p className="mt-3">
                  This may include use in marketing materials, event reports,
                  internal presentations, or promotional content related to
                  Ignite or its clients.
                </p>
              </SubSection>

              <SubSection id="likeness-social-2" title="9.2 Social Media">
                <p>
                  The contractor may not post event-related content about an
                  Activation unless such posting has been authorized by Ignite
                  or the client.
                </p>

                <p className="mt-3">
                  Any approved content must comply with the client’s brand
                  guidelines and any instructions provided by Ignite.
                </p>
              </SubSection>

              <SubSection id="likeness-social-3" title="9.3 No Authority">
                <p>
                  The contractor has no authority to bind Ignite or its clients
                  to any agreement, representation, or commitment.
                </p>

                <p className="mt-3">
                  The contractor may not represent themselves as an employee,
                  spokesperson, or official representative of Ignite or the
                  client.
                </p>
              </SubSection>

              <SubSection id="likeness-social-4" title="9.4 FTC Compliance">
                <p>
                  If the contractor posts authorized content relating to an
                  Activation, the contractor must comply with all applicable
                  Federal Trade Commission (FTC) endorsement and disclosure
                  rules.
                </p>

                <p className="mt-3">
                  This includes clearly disclosing any material relationship
                  with Ignite or the client when posting promotional content.
                </p>
              </SubSection>

              <SubSection
                id="likeness-social-5"
                title="9.5 Non-Use of Client Marks"
              >
                <p>
                  Except where expressly authorized in writing, the contractor
                  may not use Ignite or client trademarks, logos, brand assets,
                  or proprietary materials in personal marketing, advertising,
                  or promotional materials.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="non-solicitation"
              title="10. Non-Solicitation; Non-Interference; Non-Disparagement"
            >
              <SubSection
                id="non-solicitation-1"
                title="10.1 Non-Solicitation of Ignite Personnel"
              >
                <p>
                  During the term of this Agreement and for twelve (12) months
                  thereafter, the contractor will not knowingly solicit,
                  recruit, or attempt to hire any Ignite employee or contractor
                  with whom the contractor worked directly during an Activation.
                </p>

                <p className="mt-3">
                  This restriction applies only to individuals with whom the
                  contractor had direct professional interaction through Ignite
                  projects.
                </p>
              </SubSection>

              <SubSection
                id="non-solicitation-2"
                title="10.2 Non-Solicitation of Ignite Clients"
              >
                <p>
                  During the term of this Agreement and for twelve (12) months
                  thereafter, the contractor will not knowingly solicit or
                  contract directly with any Ignite client for substantially
                  similar services if the contractor performed Services for that
                  client through Ignite or was introduced to that client through
                  Ignite.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>performed Services for the client through Ignite</li>
                  <li>was introduced to the client through Ignite</li>
                </ul>

                <p className="mt-3">
                  This restriction applies unless Ignite provides prior written
                  consent.
                </p>
              </SubSection>

              <SubSection id="non-solicitation-3" title="10.3 Non-Interference">
                <p>
                  The contractor agrees not to intentionally interfere with
                  Ignite’s relationships with its clients, vendors, contractors,
                  or partners.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>clients</li>
                  <li>vendors</li>
                  <li>contractors</li>
                  <li>partners</li>
                </ul>
              </SubSection>

              <SubSection
                id="non-solicitation-4"
                title="10.4 Confidential Information Restriction"
              >
                <p>
                  Regardless of the enforceability of the non-solicitation
                  provisions, the contractor agrees not to use Confidential
                  Information obtained through Ignite to solicit or divert
                  Ignite clients, contractors, or vendors for personal or
                  third-party business purposes.
                </p>
              </SubSection>

              <SubSection
                id="non-solicitation-5"
                title="10.5 Non-Disparagement"
              >
                <p>
                  The contractor agrees not to make knowingly false statements
                  about Ignite, its clients, or their personnel that are
                  defamatory or intended to harm their professional reputation.
                </p>

                <p className="mt-3">
                  Nothing in this section prevents the contractor from making
                  truthful statements required by law, reporting concerns to
                  government agencies, or cooperating with lawful
                  investigations.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection id="termination" title="11. Termination">
              <SubSection
                id="termination-1"
                title="11.1 Termination by Either Party"
              >
                <p>
                  Either party may terminate this Agreement at any time and for
                  any reason by providing written notice to the other party.
                </p>

                <p className="mt-3">
                  Termination does not affect obligations that accrued prior to
                  the termination date.
                </p>
              </SubSection>

              <SubSection id="termination-2" title="11.2 Termination for Cause">
                <p>
                  Ignite may terminate this Agreement immediately upon written
                  notice if the contractor materially breaches this Agreement or
                  fails to comply with required standards.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>material breach of this Agreement</li>
                  <li>violation of client or venue rules</li>
                  <li>misconduct during an Activation</li>
                  <li>failure to comply with applicable laws</li>
                  <li>failure to meet required performance standards</li>
                </ul>
              </SubSection>

              <SubSection id="termination-3" title="11.3 Effect of Termination">
                <p>
                  Upon termination of this Agreement, the contractor must
                  immediately stop performing Services under the Agreement.
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>cease performing Services</li>
                  <li>return or destroy Confidential Information</li>
                  <li>
                    complete any required deliverables for completed Activations
                  </li>
                </ul>

                <p className="mt-3">
                  Outstanding payment obligations for completed Services remain
                  subject to the payment terms of this Agreement.
                </p>
              </SubSection>

              <SubSection id="termination-4" title="11.4 Survival">
                <p>
                  Certain provisions of this Agreement survive termination,
                  including:
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>Confidentiality (Section 7)</li>
                  <li>Intellectual Property (Section 8)</li>
                  <li>Non-Solicitation and Non-Disparagement (Section 10)</li>
                  <li>
                    Limitation of Liability and Indemnification provisions
                  </li>
                  <li>Any provisions that reasonably survive termination</li>
                </ul>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="company-property"
              title="12. Company Property; Corporate Card"
            >
              <SubSection id="company-property-1" title="12.1 Company Property">
                <p>
                  You agree to maintain in good condition any property provided
                  by Ignite or its client (“Company Property”).
                </p>
              </SubSection>

              <SubSection
                id="company-property-2"
                title="12.2 Return Upon Request or Default"
              >
                <p>
                  Return all Company Property upon request, at the end of an
                  Activation, or upon a performance default.
                </p>
              </SubSection>

              <SubSection id="company-property-3" title="12.3 Return Deadline">
                <p>
                  Company Property must be returned within seven (7) days of the
                  default date or earlier request date.
                </p>
              </SubSection>

              <SubSection
                id="company-property-4"
                title="12.4 Failure to Return; Offset"
              >
                <p>
                  If Company Property is not returned as required, Ignite may:
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>withhold or offset amounts owed</li>
                  <li>seek return of the property or its value</li>
                  <li>
                    seek reasonable recovery costs including attorney’s fees
                    where permitted by law
                  </li>
                </ul>
              </SubSection>

              <SubSection id="company-property-5" title="12.5 Corporate Card">
                <p>If Ignite provides a Company Card:</p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>
                    <strong>Authorized Use Only.</strong> Only for pre-approved,
                    Activation-related purchases.
                  </li>
                  <li>
                    <strong>Receipts Required.</strong> Submit original itemized
                    receipts within forty-eight (48) hours.
                  </li>
                  <li>
                    <strong>Unauthorized Charges.</strong> Ignite may withhold
                    unauthorized charges from compensation to the maximum extent
                    permitted by law.
                  </li>
                  <li>
                    <strong>Lost or Stolen.</strong> Immediately notify Ignite
                    if a Company Card is lost, stolen, or compromised.
                  </li>
                </ul>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="vehicle-insurance-liability"
              title="13. Vehicle Use; Insurance; Indemnification; Limitation of Liability"
            >
              <SubSection id="vehicle-1" title="13.1 Vehicle Use">
                <p>
                  If you use a personal vehicle, you do so as an independent
                  contractor. Ignite does not direct or control your vehicle
                  operation.
                </p>
              </SubSection>

              <SubSection id="vehicle-2" title="13.2 Contractor Responsibility">
                <p>You assume all risk for vehicle operation including:</p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>vehicle maintenance</li>
                  <li>accidents</li>
                  <li>injuries</li>
                  <li>property damage</li>
                  <li>citations</li>
                  <li>insurance claims</li>
                </ul>
              </SubSection>

              <SubSection id="vehicle-3" title="13.3 Required Insurance">
                <p>You must maintain at all times:</p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>a valid driver’s license</li>
                  <li>legally required automobile liability insurance</li>
                </ul>
              </SubSection>

              <SubSection id="vehicle-4" title="13.4 No Transporting Others">
                <p>
                  You may not transport other contractors, client personnel, or
                  event attendees without Ignite’s prior written approval.
                </p>
              </SubSection>

              <SubSection
                id="vehicle-5"
                title="13.5 Indemnification by Contractor"
              >
                <p>
                  You agree to indemnify, defend, and hold harmless Ignite and
                  its clients from claims arising from:
                </p>

                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li>breach of this Agreement</li>
                  <li>negligence or willful misconduct</li>
                  <li>violation of law</li>
                  <li>third-party rights infringement</li>
                  <li>vehicle use related to the Services</li>
                </ul>
              </SubSection>

              <SubSection
                id="vehicle-6"
                title="13.6 Indemnification by Company"
              >
                <p>
                  Ignite will indemnify you for claims arising solely from
                  Ignite’s gross negligence or willful misconduct.
                </p>
              </SubSection>

              <SubSection id="vehicle-7" title="13.7 Limitation of Liability">
                <p>
                  Except for indemnification obligations, breaches of
                  confidentiality, intellectual property infringement, fraud, or
                  willful misconduct, neither party will be liable for indirect,
                  incidental, special, or consequential damages.
                </p>

                <p className="mt-3">
                  Ignite’s total liability will not exceed the total fees paid
                  for the Activation giving rise to the claim.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="dispute-resolution"
              title="14. Dispute Resolution; Arbitration"
            >
              <SubSection id="dispute-1" title="14.1 Good Faith Resolution">
                <p>
                  The Parties agree to attempt informal resolution in good faith
                  before initiating formal legal proceedings.
                </p>

                <p className="mt-3">
                  The Parties will attempt to resolve disputes informally for at
                  least thirty (30) days before pursuing arbitration or
                  litigation.
                </p>
              </SubSection>

              <SubSection id="dispute-2" title="14.2 Binding Arbitration">
                <p>
                  Except for small claims matters or requests for injunctive
                  relief related to confidentiality or intellectual property
                  violations, disputes will be resolved through binding
                  arbitration under the American Arbitration Association (AAA)
                  commercial arbitration rules.
                </p>

                <p className="mt-3">
                  Arbitration will be conducted before a single arbitrator.
                </p>
              </SubSection>

              <SubSection id="dispute-3" title="14.3 Location">
                <p>
                  Arbitration will take place in the state where the Contractor
                  performed the Services unless the Parties mutually agree to a
                  different location.
                </p>
              </SubSection>

              <SubSection id="dispute-4" title="14.4 Class Action Waiver">
                <p className="font-semibold">
                  YOU AGREE THAT ANY ARBITRATION OR LEGAL PROCEEDING SHALL BE
                  CONDUCTED ON AN INDIVIDUAL BASIS AND NOT AS A CLASS ACTION,
                  COLLECTIVE ACTION, OR REPRESENTATIVE ACTION.
                </p>

                <p className="mt-3 font-semibold">
                  YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT
                  OR CLASS-WIDE ARBITRATION AGAINST IGNITE.
                </p>
              </SubSection>

              <SubSection id="dispute-5" title="14.5 Arbitration Opt-Out">
                <p>
                  You may opt out of arbitration by providing written notice to
                  Ignite within thirty (30) days of the Effective Date.
                </p>

                <p className="mt-3">
                  If you opt out, disputes will be resolved in court proceedings
                  as described in Section 15.3.
                </p>
              </SubSection>
            </AgreementSection>

            <AgreementSection
              id="general-provisions"
              title="15. General Provisions"
            >
              <SubSection id="general-1" title="15.1 Entire Agreement">
                <p>
                  This Agreement, together with the Activation Completion
                  Policy, Terms of Service, and Privacy Policy, constitutes the
                  entire agreement between the Parties and supersedes all prior
                  agreements or understandings relating to the subject matter.
                </p>
              </SubSection>

              <SubSection id="general-2" title="15.2 Amendments">
                <p>
                  Any amendment to this Agreement must be in writing and signed
                  by both Parties.
                </p>
              </SubSection>

              <SubSection id="general-3" title="15.3 Governing Law; Venue">
                <p>
                  This Agreement is governed by the laws of the State of Nevada,
                  excluding its conflict-of-law rules.
                </p>

                <p className="mt-3">
                  If arbitration is opted out or found unenforceable, exclusive
                  venue will be in Washoe County, Nevada.
                </p>

                <p className="mt-3">
                  State Addendums may modify governing law for Activations
                  performed in the applicable state.
                </p>
              </SubSection>

              <SubSection id="general-4" title="15.4 Severability">
                <p>
                  If any provision of this Agreement is held invalid or
                  unenforceable, the remaining provisions will remain in full
                  force and effect.
                </p>
              </SubSection>

              <SubSection id="general-5" title="15.5 Reformation / Blue-Pencil">
                <p>
                  A court or arbitrator may modify unenforceable provisions so
                  they become enforceable to the maximum extent permitted by law
                  while preserving the original intent.
                </p>
              </SubSection>

              <SubSection id="general-6" title="15.6 Assignment">
                <p>
                  You may not assign this Agreement without Ignite’s written
                  consent. Ignite may assign the Agreement to a successor entity
                  or affiliate.
                </p>
              </SubSection>

              <SubSection id="general-7" title="15.7 Notices">
                <p>
                  Notices must be sent to the addresses or emails listed by the
                  Parties or updated in writing.
                </p>
              </SubSection>

              <SubSection id="general-8" title="15.8 Electronic Signatures">
                <p>
                  This Agreement may be signed electronically and in
                  counterparts, each of which will be treated as an original and
                  together form a single binding agreement.
                </p>
              </SubSection>
            </AgreementSection>

            <section className="rounded-3xl border border-warning/30 bg-warning/10 px-6 py-6 sm:px-8">
              <h2 className="text-lg font-bold text-base-content sm:text-xl">
                State-Specific Addendums
              </h2>

              <p className="mt-3 text-sm leading-7 text-base-content/80 sm:text-base">
                The following addendums apply when you perform Services in the
                listed state. Each addendum supplements — but does not replace —
                the remainder of this Agreement.
              </p>

              <p className="mt-3 text-sm leading-7 text-base-content/80 sm:text-base">
                If a state-specific provision conflicts with the general terms
                of this Agreement, the state-specific provision controls for
                Activations performed in that state.
              </p>
            </section>

            <AgreementSection
              id="california-addendum"
              title="16. California Addendum"
            >
              <p>
                If you perform Services in the State of California, the
                following terms apply. California applies the ABC test (Labor
                Code §2775) for worker classification. This addendum addresses
                all three prongs.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business (Prong B).</strong> You represent
                  that you operate as an independently established trade,
                  occupation, or business, or have the bona fide intention to
                  establish one. You are providing Services to Ignite as a
                  business-to-business engagement.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation
                  constitutes a discrete, project-based engagement with a
                  defined scope, deliverables, location, timeline, and
                  Activation Fee.
                </li>

                <li>
                  <strong>Control of Manner and Means (Prong A).</strong> You
                  retain full control over the manner and means of performing
                  Services, subject only to agreed deliverables, brand safety
                  standards, and event timing.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You are free to offer and
                  perform similar services for other entities, including
                  competitors of Ignite.
                </li>

                <li>
                  <strong>Outside Usual Course (Prong C).</strong> You
                  acknowledge that you perform Services as part of your own
                  independently established business of providing promotional,
                  marketing, event, or related services.
                </li>

                <li>
                  <strong>Arbitration in California.</strong> For Services
                  performed in California, arbitration shall be conducted in the
                  State of California unless the Parties agree otherwise.
                </li>

                <li>
                  <strong>Severability.</strong> If any provision of this
                  Agreement is found unenforceable under California law, the
                  remaining provisions remain in full force.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="massachusetts-addendum"
              title="17. Massachusetts Addendum"
            >
              <p>
                If you perform Services in the Commonwealth of Massachusetts,
                the following terms apply. Massachusetts applies the ABC test
                (M.G.L. c. 149 §148B) for worker classification, substantially
                similar to California’s.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business (Prong B).</strong> You represent
                  that you operate as an independently established trade,
                  occupation, or business of the same nature as the Services
                  performed and maintain your own business entity or clientele
                  separate from Ignite.
                </li>

                <li>
                  <strong>Free from Control (Prong A).</strong> You are free
                  from Ignite’s control and direction in the performance of the
                  Services, both under this Agreement and in fact.
                </li>

                <li>
                  <strong>Outside Usual Course (Prong C).</strong> The Services
                  you perform are part of your own independently established
                  business and are not performed exclusively or primarily for
                  Ignite.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You are free to provide
                  similar services to other entities at any time.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete, project-based engagement with a defined scope and
                  deliverables.
                </li>

                <li>
                  <strong>Arbitration in Massachusetts.</strong> For Services
                  performed in Massachusetts, arbitration shall be conducted in
                  the Commonwealth of Massachusetts unless otherwise agreed.
                </li>

                <li>
                  <strong>Wage Act Acknowledgment.</strong> If compensation
                  under this Agreement is reclassified as wages under M.G.L. c.
                  149 §148, Ignite will comply with applicable payment timing
                  requirements.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="new-jersey-addendum"
              title="18. New Jersey Addendum"
            >
              <p>
                If you perform Services in the State of New Jersey, the
                following terms apply. New Jersey applies the ABC test (N.J.S.A.
                43:21-19(i)(6)) and enhanced misclassification penalties under
                N.J.S.A. 34:20-1 et seq.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business (Prong B).</strong> You represent
                  that you are customarily engaged in an independently
                  established trade, occupation, profession, or business of the
                  same nature as the Services.
                </li>

                <li>
                  <strong>Free from Control (Prong A).</strong> You are free
                  from Ignite’s control and direction in performing the
                  Services, both under this Agreement and in fact.
                </li>

                <li>
                  <strong>Outside Usual Course (Prong C).</strong> The Services
                  are performed outside of Ignite’s primary place of business
                  and are part of your own independently established business.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities at any time.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  distinct project with defined deliverables and compensation.
                </li>

                <li>
                  <strong>Arbitration in New Jersey.</strong> For Services
                  performed in New Jersey, arbitration shall be conducted in the
                  State of New Jersey unless otherwise agreed.
                </li>

                <li>
                  <strong>Anti-Retaliation.</strong> Ignite will not retaliate
                  against you for asserting rights under New Jersey worker
                  classification laws.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="illinois-addendum"
              title="19. Illinois / Chicago Addendum"
            >
              <p>
                If you perform Services in the State of Illinois, the following
                terms apply. Illinois applies the ABC test for unemployment
                insurance purposes (820 ILCS 185) and Chicago has additional
                worker classification ordinances.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business.</strong> You represent that you
                  are engaged in an independently established trade, occupation,
                  or business.
                </li>

                <li>
                  <strong>Free from Control.</strong> You are free from Ignite’s
                  control and direction in performing Services.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You are free to provide
                  similar services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation
                  constitutes a discrete, project-based engagement.
                </li>

                <li>
                  <strong>Chicago Fair Workweek Acknowledgment.</strong> If
                  applicable, Ignite acknowledges the Chicago Fair Workweek
                  Ordinance and will provide reasonable scheduling notice for
                  Chicago-based Activations.
                </li>

                <li>
                  <strong>
                    Illinois Day and Temporary Labor Services Act.
                  </strong>
                  Ignite will comply with the Day and Temporary Labor Services
                  Act (820 ILCS 175) where applicable.
                </li>

                <li>
                  <strong>Arbitration in Illinois.</strong> For Services
                  performed in Illinois, arbitration shall be conducted in the
                  State of Illinois unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="new-york-addendum"
              title="20. New York / New York City Addendum"
            >
              <p>
                If you perform Services in the State of New York, the following
                terms apply. New York uses a multi-factor “economic reality”
                test for worker classification. New York City additionally
                imposes requirements under the Freelance Isn’t Free Act (NYC
                Admin. Code §20-927 et seq.).
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Economic Reality Factors.</strong> The Parties intend
                  that this Agreement reflects an independent contractor
                  relationship. You control the manner and means of your work,
                  provide your own tools, may accept or decline engagements, are
                  paid per project, and may realize profit or loss based on your
                  performance.
                </li>

                <li>
                  <strong>NYC Freelance Isn’t Free Act Compliance.</strong> For
                  NYC engagements exceeding $800 (individually or in aggregate
                  over 120 days), this Agreement serves as the required written
                  contract. Ignite will pay within thirty (30) days of
                  deliverable completion, will not condition payment on
                  acceptance of less than the contracted amount, and will not
                  retaliate against you for exercising rights under the Act.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You are free to provide
                  similar services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete project engagement.
                </li>

                <li>
                  <strong>Arbitration in New York.</strong> For Services
                  performed in New York, arbitration shall be conducted in the
                  State of New York unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="washington-addendum"
              title="21. Washington State Addendum"
            >
              <p>
                If you perform Services in the State of Washington, the
                following terms apply. Washington applies a modified ABC test
                under RCW 51.08.195 and RCW 50.04.140.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business.</strong> You represent that you
                  are an independently established business providing Services
                  of the same nature as those performed under this Agreement.
                </li>

                <li>
                  <strong>Free from Control.</strong> You are free from
                  direction and control over the means of performing Services.
                </li>

                <li>
                  <strong>Outside Usual Course.</strong> The Services are part
                  of your own independently established business.
                </li>

                <li>
                  <strong>Separate Business Location.</strong> You maintain or
                  intend to maintain a business location separate from Ignite’s
                  (which may include a home office).
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete, project-based engagement.
                </li>

                <li>
                  <strong>Arbitration in Washington.</strong> For Services
                  performed in Washington, arbitration shall be conducted in the
                  State of Washington unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection id="oregon-addendum" title="22. Oregon Addendum">
              <p>
                If you perform Services in the State of Oregon, the following
                terms apply. Oregon applies its own version of the ABC test
                under ORS 670.600.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business.</strong> You represent that you
                  are an independently established business and are free from
                  direction and control over the means of performing Services.
                </li>

                <li>
                  <strong>Contractor Registration.</strong> To the extent
                  required by Oregon law, you will register as an independent
                  contractor with the Oregon Construction Contractors Board or
                  equivalent agency, or qualify for an applicable exemption.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You are free to provide
                  similar services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation
                  constitutes a discrete, project-based engagement with defined
                  deliverables.
                </li>

                <li>
                  <strong>Written Agreement Requirement.</strong> This Agreement
                  satisfies Oregon’s requirement for a written contract
                  specifying the services to be performed and the compensation.
                </li>

                <li>
                  <strong>Arbitration in Oregon.</strong> For Services performed
                  in Oregon, arbitration shall be conducted in the State of
                  Oregon unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="colorado-addendum"
              title="23. Colorado Addendum"
            >
              <p>
                If you perform Services in the State of Colorado, the following
                terms apply. Colorado has expanded worker classification
                scrutiny under the Colorado Independent Contractor Protections
                Act and applies a totality-of-the-circumstances test.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Customarily Engaged.</strong> You represent that you
                  are customarily engaged in an independent trade, occupation,
                  profession, or business related to the Services.
                </li>

                <li>
                  <strong>Free from Control.</strong> You are free from control
                  and direction over the means of performing Services, both
                  under this Agreement and in fact.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  defined project with specific deliverables, compensation, and
                  timeline.
                </li>

                <li>
                  <strong>Equal Pay for Equal Work Act.</strong> Ignite will
                  comply with Colorado’s Equal Pay for Equal Work Act to the
                  extent applicable to contractor engagements, including
                  compensation transparency requirements.
                </li>

                <li>
                  <strong>Arbitration in Colorado.</strong> For Services
                  performed in Colorado, arbitration shall be conducted in the
                  State of Colorado unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="connecticut-addendum"
              title="24. Connecticut Addendum"
            >
              <p>
                If you perform Services in the State of Connecticut, the
                following terms apply. Connecticut applies the ABC test (Conn.
                Gen. Stat. §31-222(a)(1)(B)(ii)) for worker classification.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business (Prong B).</strong> You represent
                  that you are customarily engaged in an independently
                  established trade, occupation, or business of the same nature
                  as the Services.
                </li>

                <li>
                  <strong>Free from Control (Prong A).</strong> You are free
                  from control and direction in performing Services.
                </li>

                <li>
                  <strong>Outside Usual Course (Prong C).</strong> The Services
                  are part of your own independently established business.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete engagement with defined deliverables.
                </li>

                <li>
                  <strong>Arbitration in Connecticut.</strong> For Services
                  performed in Connecticut, arbitration shall be conducted in
                  the State of Connecticut unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="vermont-addendum"
              title="25. Vermont Addendum"
            >
              <p>
                If you perform Services in the State of Vermont, the following
                terms apply. Vermont applies the ABC test (21 V.S.A. §1301(6))
                for worker classification purposes.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independent Business (Prong B).</strong> You represent
                  that you are customarily engaged in an independently
                  established trade, occupation, or business.
                </li>

                <li>
                  <strong>Free from Control (Prong A).</strong> You are free
                  from control and direction in performing Services.
                </li>

                <li>
                  <strong>Outside Usual Course (Prong C).</strong> The Services
                  are part of your own independently established business.
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete, project-based engagement.
                </li>

                <li>
                  <strong>Arbitration in Vermont.</strong> For Services
                  performed in Vermont, arbitration shall be conducted in the
                  State of Vermont unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection
              id="minnesota-addendum"
              title="26. Minnesota Addendum"
            >
              <p>
                If you perform Services in the State of Minnesota, the following
                terms apply. Minnesota has expanded contractor classification
                scrutiny under Minn. Stat. §181.722 and evaluates multiple
                factors.
              </p>

              <ul className="list-disc ml-6 space-y-3 mt-4">
                <li>
                  <strong>Independently Established Business.</strong> You
                  represent that you maintain an independently established
                  business and are not economically dependent on Ignite as your
                  sole or primary source of income.
                </li>

                <li>
                  <strong>Right to Refuse.</strong> You have the right to accept
                  or refuse any Activation at your sole discretion, without
                  penalty.
                </li>

                <li>
                  <strong>Control of Work.</strong> You control the manner and
                  means of performing Services, subject to agreed deliverables
                  and safety requirements.
                </li>

                <li>
                  <strong>Separate Business Presence.</strong> You maintain or
                  intend to maintain a business presence separate from Ignite
                  (which may include a home office, website, business cards, or
                  professional accounts).
                </li>

                <li>
                  <strong>Non-Exclusivity.</strong> You may provide similar
                  services to other entities.
                </li>

                <li>
                  <strong>Discrete Project Scope.</strong> Each Activation is a
                  discrete, project-based engagement with defined deliverables
                  and compensation.
                </li>

                <li>
                  <strong>Arbitration in Minnesota.</strong> For Services
                  performed in Minnesota, arbitration shall be conducted in the
                  State of Minnesota unless otherwise agreed.
                </li>
              </ul>
            </AgreementSection>

            <AgreementSection id="contact" title="27. Contact Information">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Company */}
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
                    Company
                  </p>
                  <p className="mt-2 font-semibold leading-snug">
                    Ignite Productions
                    <br />
                    LLC
                  </p>
                </div>

                {/* Email */}
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
                    Email
                  </p>
                  <a
                    href="mailto:events@igniteproductions.co"
                    className="mt-2 block font-semibold break-all hover:underline"
                  >
                    events@igniteproductions.co
                  </a>
                </div>

                {/* Phone */}
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
                    Phone
                  </p>
                  <a
                    href="tel:+17754060435"
                    className="mt-2 block font-semibold hover:underline"
                  >
                    775.406.0435
                  </a>
                </div>

                {/* Website */}
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
                    Website
                  </p>
                  <a
                    href="https://www.igniteproductions.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block font-semibold break-all hover:underline"
                  >
                    www.igniteproductions.co
                  </a>
                </div>
              </div>
            </AgreementSection>
          </main>
        </div>
      </div>
    </div>
  );
}
