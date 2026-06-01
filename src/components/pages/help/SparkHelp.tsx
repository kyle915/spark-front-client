/**
 * Spark v2 — Help & Support page.
 *
 * Primary support path is the ticket form, which opens a real ticket via
 * createSupportTicket (success/error surfaced through the alert store).
 * Direct-contact cards stay as a secondary fallback for urgent, day-of
 * issues that shouldn't wait on a ticket. FAQs and a live system-status
 * card round out the page.
 */

import { useState } from "react";
import { useMutation } from "react-relay/hooks";

import Layout from "@/layout/Layout";
import { CreateSupportTicketMutation } from "@/api/mutations/CreateSupportTicketMutation";
import type { CreateSupportTicketMutation as CreateSupportTicketMutationType } from "@api/mutations/__generated__/CreateSupportTicketMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

type FAQItem = {
  q: string;
  a: React.ReactNode;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "question", label: "General question" },
  { value: "bug", label: "Something's broken (bug)" },
  { value: "billing", label: "Billing / payroll" },
  { value: "other", label: "Something else" },
];

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

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
};

const captionStyle: React.CSSProperties = {
  letterSpacing: "0.16em",
  color: "rgba(255,255,255,0.55)",
};

const SupportTicketForm: React.FC = () => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [body, setBody] = useState("");

  const [commit, inFlight] = useMutation<CreateSupportTicketMutationType>(
    CreateSupportTicketMutation,
  );

  const canSubmit = !inFlight && subject.trim() !== "" && body.trim() !== "";

  const submit = () => {
    if (!canSubmit) return;

    commit({
      variables: {
        input: {
          subject: subject.trim(),
          body: body.trim(),
          category,
        },
      },
      onCompleted: (res) => {
        const payload = res.createSupportTicket;
        if (payload?.success) {
          showAlert(
            "Support request sent — we'll be in touch.",
            "success",
          );
          setSubject("");
          setCategory(CATEGORIES[0].value);
          setBody("");
        } else {
          showAlert(
            payload?.message ?? "Couldn't send your request.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Couldn't send your request: ${err.message}`, "error"),
    });
  };

  return (
    <div className="spark-card p-5 space-y-3">
      <p
        className="mono text-[10px]"
        style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}
      >
        ✦ OPEN A SUPPORT REQUEST
      </p>
      <label className="block">
        <span className="mono text-[10px]" style={captionStyle}>
          SUBJECT
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Short summary of what you need"
          className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        />
      </label>
      <label className="block">
        <span className="mono text-[10px]" style={captionStyle}>
          CATEGORY
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mono text-[10px]" style={captionStyle}>
          DETAILS
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="What's going on? Include the request URL and any steps if it's a bug."
          className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        />
      </label>
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            border: "none",
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {inFlight ? "SENDING…" : "SEND REQUEST"}
        </button>
      </div>
    </div>
  );
};

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
            Send the Ignite team a support request, browse the FAQs, or
            reach us directly.
          </p>
        </div>

        {/* Primary support path: open a ticket */}
        <SupportTicketForm />

        {/* Secondary fallback: direct contact for urgent / day-of issues */}
        <div>
          <h2
            className="display text-2xl font-bold mb-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Need a human right now?
          </h2>
          <p
            className="text-sm mb-3"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            For active shifts and time-sensitive issues, skip the ticket
            and reach us directly.
          </p>
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
