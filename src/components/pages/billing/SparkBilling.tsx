/**
 * Spark v2 — Billing page.
 *
 * Client-facing invoices + payment methods. Honest-preview shell
 * for v1 — the Stripe integration ships in a follow-up. Layout is
 * production-ready so the swap from "stub" to "real" is just
 * data wiring.
 *
 * No fake dollar amounts on screen — the hero card calls out that
 * the integration is in flight so brand stakeholders don't
 * mistake a placeholder for a real invoice.
 */

import React from "react";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";

const RESOURCE_LINKS = [
  {
    emoji: "💸",
    title: "Email finance",
    body: "finance@igniteproductions.co — invoice questions, payment terms, W-9s",
    href: "mailto:finance@igniteproductions.co",
  },
  {
    emoji: "📄",
    title: "Master Services Agreement",
    body: "Standard MSA + statement of work templates",
    href: "mailto:legal@igniteproductions.co",
  },
  {
    emoji: "🏦",
    title: "ACH / wire details",
    body: "Routing + account on file. Reach out to finance for transfer instructions.",
    href: "mailto:finance@igniteproductions.co",
  },
];

const Inner: React.FC = () => (
  <div className="space-y-6 max-w-5xl">
    <div>
      <p
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        BILLING
      </p>
      <h1
        className="display text-4xl font-bold mt-2"
        style={{ letterSpacing: "-0.04em" }}
      >
        Invoices &amp; payment.
      </h1>
      <p
        className="mt-2"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Brand-side billing: invoices, payment methods, and account
        balance. Vendor payouts to BAs live in{" "}
        <a
          href="/payments"
          style={{ color: "var(--spark-sky)" }}
        >
          Payments · Wingspan
        </a>{" "}
        — that's a different surface.
      </p>
    </div>

    {/* Honest-preview hero — no fake dollars */}
    <div
      className="spark-card p-8"
      style={{
        borderColor: "rgba(255,196,0,0.35)",
        background: "rgba(255,196,0,0.04)",
      }}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,196,0,0.10)",
            color: "var(--spark-gold)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
          }}
        >
          $
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-gold)",
            }}
          >
            STRIPE INTEGRATION · IN FLIGHT
          </p>
          <h2
            className="display text-2xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Live invoices &amp; ACH land here.
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Stripe is the source of truth for brand-side billing. Once
            connected, this page shows open invoices, payment status,
            ACH details on file, and a download archive — pulled
            directly from Stripe so there's never a sync mismatch.
          </p>
          <p
            className="mt-3 text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Until then, finance handles invoices manually — contact{" "}
            <a
              href="mailto:finance@igniteproductions.co"
              style={{ color: "var(--spark-text)" }}
            >
              finance@igniteproductions.co
            </a>{" "}
            for any billing questions.
          </p>
        </div>
      </div>
    </div>

    {/* What's coming */}
    <div>
      <h2
        className="display text-xl font-bold mb-3"
        style={{ letterSpacing: "-0.02em" }}
      >
        What ships in v1
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FeatureCard
          icon="📨"
          title="Open invoices"
          body="Outstanding charges + due dates + a clear total. PDF download per invoice."
        />
        <FeatureCard
          icon="✅"
          title="Payment history"
          body="Receipts for every payment with the linked invoice + payment method."
        />
        <FeatureCard
          icon="🏦"
          title="Payment methods"
          body="ACH + card. Update directly via Stripe's hosted forms — no card data touches Spark."
        />
        <FeatureCard
          icon="📊"
          title="Account balance"
          body="Real-time outstanding balance, with a one-click 'Pay now' for open invoices."
        />
        <FeatureCard
          icon="🔁"
          title="Auto-pay"
          body="Opt-in to charge the saved method N days before the due date."
        />
        <FeatureCard
          icon="📤"
          title="Export"
          body="CSV export of all invoices + receipts for the accountant. Filter by quarter."
        />
      </div>
    </div>

    {/* Get help */}
    <div>
      <h2
        className="display text-xl font-bold mb-3"
        style={{ letterSpacing: "-0.02em" }}
      >
        Get help now
      </h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {RESOURCE_LINKS.map((r) => (
          <a
            key={r.title}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="spark-card hov p-5 block"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <p className="text-2xl mb-2">{r.emoji}</p>
            <p className="font-bold text-sm">{r.title}</p>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {r.body}
            </p>
          </a>
        ))}
      </div>
    </div>
  </div>
);

const FeatureCard: React.FC<{
  icon: string;
  title: string;
  body: string;
}> = ({ icon, title, body }) => (
  <div className="spark-card p-5">
    <p className="text-2xl mb-2">{icon}</p>
    <p className="font-bold text-sm">{title}</p>
    <p
      className="text-xs mt-1 leading-relaxed"
      style={{ color: "rgba(255,255,255,0.55)" }}
    >
      {body}
    </p>
  </div>
);

export default function SparkBilling() {
  // Visible to both admins and clients — brand stakeholders need
  // this page once it's wired. For now both see the honest-preview
  // shell.
  useSparkRole();
  return (
    <Layout>
      <Inner />
    </Layout>
  );
}
