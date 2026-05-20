/**
 * Spark v2 — Help & Support page.
 *
 * Static for v1 — no support backend yet. Surfaces the things admins
 * actually ask about: getting BAs onto a shift, the recap workflow,
 * payroll questions, and contact paths. When a real ticketing
 * integration ships (Linear / Zendesk / etc.) swap the support card
 * for a real form.
 */

import Layout from "@/layout/Layout";

type FAQItem = {
  q: string;
  a: React.ReactNode;
};

const FAQS: FAQItem[] = [
  {
    q: "How do I invite a BA to a shift?",
    a: (
      <>
        Open the request → click the lime <strong>✦ INVITE BA</strong>{" "}
        button at the top. Pick a Brand Ambassador from the list and
        Spark sends them a "New shift offered" push. They can{" "}
        Accept or Decline from the mobile Shifts tab.
      </>
    ),
  },
  {
    q: "How do I see who's confirmed for a shift?",
    a: (
      <>
        On the request view, scroll to the{" "}
        <strong>ROSTER · &lt;shift name&gt;</strong> panel. Lime{" "}
        <strong>ACCEPTED</strong> chips are committed BAs; gold{" "}
        <strong>PENDING</strong> chips are waiting on a response. You
        can cancel or remove rows from the same panel.
      </>
    ),
  },
  {
    q: "What is the Recap Due badge for?",
    a: (
      <>
        Counts shifts whose end time has passed but no recap has been
        filed. The sidebar lights up when ≥1 is due. The badge resets
        once the BA submits a recap, or you can dismiss it on the
        Master Tracker row.
      </>
    ),
  },
  {
    q: "How does payroll work?",
    a: (
      <>
        Spark doesn't run payroll directly — your BA payouts live in{" "}
        <strong>Wingspan</strong> (1099 / contractor) and{" "}
        <strong>Gusto</strong> (W-2 / employee). The mobile Earnings
        tab surfaces a shift count and an hours estimate so BAs can
        cross-check Wingspan / Gusto before the period closes.
      </>
    ),
  },
  {
    q: "How do I get push notifications to a BA?",
    a: (
      <>
        Push fires automatically on three moments: a new shift offer,
        15 minutes before a shift starts (activation reminder), and 4
        hours after a shift ends with no recap filed (recap nudge).
        The BA needs to have signed in to the mobile app at least
        once to register their device.
      </>
    ),
  },
  {
    q: "Can I bulk-upload events from a spreadsheet?",
    a: (
      <>
        Yes — head to <strong>Bulk Upload</strong>. Click "Get the
        template", fill in the rows, and drop the file back. Spark
        validates each row and creates a request + event per row.
      </>
    ),
  },
  {
    q: "Where do my custom request forms go?",
    a: (
      <>
        Form Builder (<code>/forms/builder</code>) lets you define
        custom field sets per request type. v1 stores definitions
        locally in your browser — backend persistence ships in a
        follow-up.
      </>
    ),
  },
];

const ResourceLink: React.FC<{
  emoji: string;
  title: string;
  body: string;
  href: string;
}> = ({ emoji, title, body, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="spark-card hov p-5 block"
    style={{ textDecoration: "none", color: "inherit" }}
  >
    <p className="text-2xl mb-2">{emoji}</p>
    <p className="font-bold text-sm">{title}</p>
    <p
      className="text-xs mt-1"
      style={{ color: "rgba(255,255,255,0.55)" }}
    >
      {body}
    </p>
  </a>
);

export default function SparkHelp() {
  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            HELP · SUPPORT
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            How can we help?
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            FAQs, runbooks, and direct lines to the Ignite team.
          </p>
        </div>

        {/* Contact + resources */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ResourceLink
            emoji="✉"
            title="Email staffing"
            body="staffing@igniteproductions.co — invites, scheduling, recaps"
            href="mailto:staffing@igniteproductions.co"
          />
          <ResourceLink
            emoji="💸"
            title="Email finance"
            body="finance@igniteproductions.co — payroll, billing, invoices"
            href="mailto:finance@igniteproductions.co"
          />
          <ResourceLink
            emoji="🚨"
            title="Urgent / day-of issue"
            body="Text Kyle at +1 (513) 614-3884 — only for active shifts"
            href="sms:+15136143884"
          />
        </div>

        {/* FAQ */}
        <div>
          <h2
            className="display text-2xl font-bold mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            Frequently asked
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="spark-card p-5"
                style={{ cursor: "pointer" }}
              >
                <summary
                  className="font-bold text-sm"
                  style={{ listStyle: "none" }}
                >
                  {f.q}
                </summary>
                <div
                  className="text-sm mt-3 leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Status */}
        <div
          className="spark-card p-5"
          style={{ borderColor: "rgba(95,184,239,0.25)" }}
        >
          <p
            className="mono text-[10px] mb-2"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-sky)",
            }}
          >
            ● SYSTEM STATUS
          </p>
          <p className="text-sm">
            Live on production · Cloud Run (us-central1) ·{" "}
            <a
              href="/select-company"
              className="underline"
              style={{ color: "var(--spark-sky)" }}
            >
              switch workspace ↗
            </a>
          </p>
          <p
            className="mono text-[10px] mt-2"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Hit a bug? Email{" "}
            <a
              href="mailto:engineering@igniteproductions.co"
              style={{ color: "var(--spark-text)" }}
            >
              engineering@igniteproductions.co
            </a>{" "}
            with the request URL and a screenshot — that's the
            fastest path to a fix.
          </p>
        </div>
      </div>
    </Layout>
  );
}
