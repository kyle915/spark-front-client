import React, { Suspense, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import { providerSubmitUrl } from "@/utils/publicHosts";
import {
  computeVisitMeterProgress,
  currentDateInTimezone,
  formatPilotCountdown,
  planBadgeMeta,
  subscriptionStatusBadge,
} from "./pilotHelpers";
import {
  PilotQueriesPlansAndBillingQuery,
  PilotQueriesPreviewPlanChangeQuery,
} from "@/api/queries/PilotQueries";
import {
  PilotMutationsApproveVolumeBandMutation,
  PilotMutationsCancelSubscriptionMutation,
  PilotMutationsChangeSubscriptionPlanMutation,
  PilotMutationsCompleteTestCheckoutMutation,
  PilotMutationsCreatePortalSessionMutation,
  PilotMutationsCreateSubscriptionCheckoutMutation,
  PilotMutationsProvisionProPilotMutation,
  PilotMutationsReverseCanonicalVisitMutation,
  PilotMutationsRunBillingTestCheckMutation,
  PilotMutationsScheduleStandaloneVisitMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesPlansAndBillingQuery as BillingQueryType } from "@/api/queries/__generated__/PilotQueriesPlansAndBillingQuery.graphql";
import type { PilotQueriesPreviewPlanChangeQuery as PreviewQueryType } from "@/api/queries/__generated__/PilotQueriesPreviewPlanChangeQuery.graphql";
import type { PilotMutationsCreateSubscriptionCheckoutMutation as CheckoutMutationType } from "@/api/mutations/__generated__/PilotMutationsCreateSubscriptionCheckoutMutation.graphql";
import type { PilotMutationsCompleteTestCheckoutMutation as CompleteTestMutationType } from "@/api/mutations/__generated__/PilotMutationsCompleteTestCheckoutMutation.graphql";
import type { PilotMutationsCreatePortalSessionMutation as PortalMutationType } from "@/api/mutations/__generated__/PilotMutationsCreatePortalSessionMutation.graphql";
import type { PilotMutationsChangeSubscriptionPlanMutation as ChangePlanMutationType } from "@/api/mutations/__generated__/PilotMutationsChangeSubscriptionPlanMutation.graphql";
import type { PilotMutationsCancelSubscriptionMutation as CancelSubMutationType } from "@/api/mutations/__generated__/PilotMutationsCancelSubscriptionMutation.graphql";
import type { PilotMutationsScheduleStandaloneVisitMutation as ScheduleVisitMutationType } from "@/api/mutations/__generated__/PilotMutationsScheduleStandaloneVisitMutation.graphql";
import type { PilotMutationsReverseCanonicalVisitMutation as ReverseVisitMutationType } from "@/api/mutations/__generated__/PilotMutationsReverseCanonicalVisitMutation.graphql";
import type { PilotMutationsApproveVolumeBandMutation as ApproveVolumeMutationType } from "@/api/mutations/__generated__/PilotMutationsApproveVolumeBandMutation.graphql";
import type { PilotMutationsProvisionProPilotMutation as ProvisionPilotMutationType } from "@/api/mutations/__generated__/PilotMutationsProvisionProPilotMutation.graphql";
import type { PilotMutationsRunBillingTestCheckMutation as RunBillingTestCheckMutationType } from "@/api/mutations/__generated__/PilotMutationsRunBillingTestCheckMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;

type PreviewPayload = PreviewQueryType["response"]["previewSubscriptionPlanChange"];

const PlansAndBillingBody: React.FC<{
  fetchKey: number;
  bump: () => void;
}> = ({ fetchKey, bump }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<BillingQueryType>(
    PilotQueriesPlansAndBillingQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const ov = data.plansAndBillingOverview;
  const readiness = data.billingReadiness;
  const usage = ov.usage;
  const badge = planBadgeMeta(ov.effectivePlanCode);
  const statusBadge = subscriptionStatusBadge(ov.subscriptionStatus);
  const meter = computeVisitMeterProgress({
    completedVisitsUsed: usage.completedVisitsUsed,
    effectiveVisitCap: usage.effectiveVisitCap,
    overageAgreementApproved: usage.overageAgreementApproved,
  });

  const [commitCheckout, startingCheckout] = useMutation<CheckoutMutationType>(
    PilotMutationsCreateSubscriptionCheckoutMutation,
  );
  const [commitCompleteTest, completingTest] =
    useMutation<CompleteTestMutationType>(
      PilotMutationsCompleteTestCheckoutMutation,
    );
  const [commitPortal, openingPortal] = useMutation<PortalMutationType>(
    PilotMutationsCreatePortalSessionMutation,
  );
  const [commitChangePlan, changingPlan] = useMutation<ChangePlanMutationType>(
    PilotMutationsChangeSubscriptionPlanMutation,
  );
  const [commitCancel, cancellingSub] = useMutation<CancelSubMutationType>(
    PilotMutationsCancelSubscriptionMutation,
  );
  const [commitSchedule, schedulingVisit] =
    useMutation<ScheduleVisitMutationType>(
      PilotMutationsScheduleStandaloneVisitMutation,
    );
  const [commitReverse, reversingVisit] = useMutation<ReverseVisitMutationType>(
    PilotMutationsReverseCanonicalVisitMutation,
  );
  const [commitVolume, savingVolume] = useMutation<ApproveVolumeMutationType>(
    PilotMutationsApproveVolumeBandMutation,
  );
  const [commitProvisionPilot, provisioningPilot] =
    useMutation<ProvisionPilotMutationType>(
      PilotMutationsProvisionProPilotMutation,
    );
  const [commitBillingTestCheck, runningBillingCheck] =
    useMutation<RunBillingTestCheckMutationType>(
      PilotMutationsRunBillingTestCheckMutation,
    );

  const [previewModal, setPreviewModal] = useState<PreviewPayload | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  // Schedule standalone visit state (shows live cap enforcement!)
  const [schedStore, setSchedStore] = useState("");
  const [schedCity, setSchedCity] = useState("");
  const [schedState, setSchedState] = useState("");
  const [schedDate, setSchedDate] = useState(() =>
    currentDateInTimezone(usage.businessTimezone),
  );
  const [mintedVisitLink, setMintedVisitLink] = useState<string | null>(null);

  // Volume band / overage consent state
  const [bandVisits, setBandVisits] = useState(
    String(usage.effectiveVisitCap ?? 100),
  );
  const [overageApproved, setOverageApproved] = useState(
    usage.overageAgreementApproved,
  );

  // Cancel reason
  const [cancelReason, setCancelReason] = useState("");

  // Banner / error feedback
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urlTestSessionId = searchParams.get("test_checkout_session");
  const activeOpenCheckout =
    ov.openCheckouts.find((c) => c.status === "open") ?? null;
  const pendingTestSessionId =
    urlTestSessionId || activeOpenCheckout?.stripeSessionId || null;

  const openPlanChangeModal = async (targetPlanCode: string) => {
    setError(null);
    setBanner(null);
    setLoadingPreview(true);
    try {
      const res = await fetchQuery<PreviewQueryType>(
        environment,
        PilotQueriesPreviewPlanChangeQuery,
        { targetPlanCode },
        { fetchPolicy: "network-only" },
      ).toPromise();
      if (res?.previewSubscriptionPlanChange) {
        setTermsChecked(false);
        setPreviewModal(res.previewSubscriptionPlanChange);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmPlanAction = () => {
    if (!previewModal) return;
    setError(null);
    const target = previewModal.targetPlanCode;

    // If workspace already has an active paid subscription and is changing tier or downgrading to Free
    const hasActivePaidSub =
      ov.subscriptionStatus === "active" &&
      (ov.effectivePlanCode === "core" || ov.effectivePlanCode === "pro");

    if (hasActivePaidSub || target === "free") {
      commitChangePlan({
        variables: {
          targetPlanCode: target,
          explicitTermsAccepted: termsChecked,
        },
        onCompleted: (res) => {
          const out = res.changeSubscriptionPlan;
          if (!out.ok) {
            setError(out.error || "Could not update subscription plan.");
            return;
          }
          setPreviewModal(null);
          setBanner(
            `Subscription updated (${out.status}). Historical monthly visit usage preserved.`,
          );
          bump();
        },
        onError: (err) => setError(err.message),
      });
      return;
    }

    commitCheckout({
      variables: {
        targetPlanCode: target,
        explicitTermsAccepted: termsChecked,
        idempotencyKey: `ui-chk-${ov.tenantUuid}-${target}-${usage.monthKey}`,
        successUrl: `${window.location.origin}/plans-billing?checkout=success`,
        cancelUrl: `${window.location.origin}/plans-billing?checkout=cancelled`,
      },
      onCompleted: (res) => {
        const out = res.createSubscriptionCheckout;
        if (!out.ok || !out.stripeSessionId) {
          setError(out.error || "Could not start Stripe Checkout session.");
          return;
        }
        setPreviewModal(null);
        if (ov.stripeConfiguredRemotely && out.checkoutUrl?.startsWith("https://checkout.stripe.com")) {
          window.location.assign(out.checkoutUrl);
          return;
        }
        setSearchParams({ test_checkout_session: out.stripeSessionId });
        setBanner(
          `Stripe Test Mode Checkout session (${out.stripeSessionId}) ready. Confirm below to dispatch the signed checkout.session.completed webhook.`,
        );
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleCompleteTestWebhook = (sessionId: string) => {
    setError(null);
    commitCompleteTest({
      variables: { stripeSessionId: sessionId },
      onCompleted: (res) => {
        const out = res.completeTestSubscriptionCheckout;
        if (!out.ok) {
          setError(out.error || "Could not complete test-mode checkout webhook.");
          return;
        }
        setSearchParams({});
        setBanner(
          `Verified Stripe Test Mode webhook processed (${out.status})! Workspace plan & visit allowance updated.`,
        );
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleOpenPortal = () => {
    setError(null);
    commitPortal({
      variables: { returnUrl: window.location.href },
      onCompleted: (res) => {
        const out = res.createSubscriptionPortalSession;
        if (!out.ok || !out.portalUrl) {
          setError(out.error || "Could not open Customer Billing Portal.");
          return;
        }
        if (out.portalUrl.startsWith("https://billing.stripe.com")) {
          window.location.assign(out.portalUrl);
        } else {
          setBanner(`Stripe Test Mode Customer Billing Portal session ready: ${out.portalUrl}`);
        }
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleScheduleVisit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMintedVisitLink(null);
    commitSchedule({
      variables: {
        storeName: schedStore.trim(),
        visitDate: schedDate,
        address: "",
        city: schedCity.trim(),
        stateCode: schedState.trim().toUpperCase(),
        notes: "Scheduled from Standalone Workspace",
      },
      onCompleted: (res) => {
        const out = res.scheduleStandaloneVisit;
        if (!out.ok) {
          setError(out.error || "Visit limit reached — upgrade plan to book new visits.");
          return;
        }
        const link = out.status ? providerSubmitUrl(out.status) : null;
        setMintedVisitLink(link);
        setSchedStore("");
        setBanner(
          `Scheduled new visit${out.status ? ` (mobile recap link ${out.status})` : ""}.`,
        );
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleCancelAtPeriodEnd = () => {
    setError(null);
    commitCancel({
      variables: {
        immediate: false,
        reason: cancelReason.trim() || "Self-service cancellation from portal",
      },
      onCompleted: (res) => {
        const out = res.cancelSubscription;
        if (!out.ok) {
          setError(out.error || "Could not cancel subscription.");
          return;
        }
        setBanner(
          `Subscription set to cancel at period end (${out.targetUuid || "current period"}). Paid features remain active through your paid-through date.`,
        );
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleReverseVisit = (visitUuid: string) => {
    setError(null);
    commitReverse({
      variables: {
        visitUuid,
        newStatus: "cancelled",
        reason: "Reversed from monthly usage ledger",
      },
      onCompleted: (res) => {
        if (!res.reverseCanonicalVisit.ok) {
          setError(res.reverseCanonicalVisit.error || "Could not reverse visit.");
          return;
        }
        setBanner("Visit marked cancelled — monthly completed visit meter adjusted.");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleSaveVolumeBand = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedBand = Number(bandVisits);
    commitVolume({
      variables: {
        agreedVolumeBandVisits: Number.isFinite(parsedBand) && parsedBand > 0 ? parsedBand : null,
        overageAgreementApproved: overageApproved,
        overageUnitPriceUsd: overageApproved ? "12.00" : null,
      },
      onCompleted: (res) => {
        if (!res.approveVolumeBandOrOverage.ok) {
          setError(res.approveVolumeBandOrOverage.error || "Could not update volume agreement.");
          return;
        }
        setBanner("Approved volume band / overage consent saved.");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleProvisionPilot = () => {
    setError(null);
    commitProvisionPilot({
      variables: {
        tenantUuid: ov.tenantUuid,
        pilotFeeUsd: "1500.00",
        durationDays: 60,
        includedVisitsMonthly: 100,
      },
      onCompleted: (res) => {
        if (!res.provisionProPilotWorkspace.ok) {
          setError(res.provisionProPilotWorkspace.error || "Could not provision Pro pilot.");
          return;
        }
        setBanner("Provisioned $1,500, 60-day Pro Pilot (100 visits/month, zero auto-renewal until buyer opt-in).");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleRunBillingTestCheck = () => {
    setError(null);
    commitBillingTestCheck({
      variables: { tenantUuid: ov.tenantUuid },
      onCompleted: (res) => {
        const out = res.runBillingTestCheck;
        if (!out.ok) {
          setError(out.error || "Billing readiness test check failed.");
          return;
        }
        setBanner(out.summary || "Billing readiness test check passed.");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const readinessFlags: Array<{ label: string; ok: boolean }> = readiness
    ? [
        { label: "Secret key", ok: readiness.secretKeyConfigured },
        { label: "Publishable key", ok: readiness.publishableKeyConfigured },
        { label: "Webhook secret", ok: readiness.webhookSecretConfigured },
        { label: "Core price", ok: readiness.corePriceConfigured },
        { label: "Pro price", ok: readiness.proPriceConfigured },
        { label: "Scale price", ok: readiness.scalePriceConfigured },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold mono"
              style={{ background: badge.bg, color: badge.fg }}
            >
              {ov.planDisplayName}
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold mono"
              style={{ background: statusBadge.bg, color: statusBadge.fg }}
            >
              {statusBadge.label}
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs mono"
              style={{
                background: "var(--pilot-neutral-bg)",
                color: "var(--pilot-neutral-fg)",
              }}
            >
              Stripe {ov.stripeMode.toUpperCase()} Mode
            </span>
          </div>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Plans, Visit Allowance & Recurring Billing
          </h1>
          <p className="text-xs mt-1 max-w-3xl" style={META}>
            {ov.billingSeparationNotice} Field contributors and read-only viewers are always free.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/onboarding"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold"
            style={BORDER}
          >
            Setup Checklist
          </Link>
          {ov.canManageBilling ? (
            <button
              type="button"
              disabled={openingPortal}
              onClick={handleOpenPortal}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold"
              style={BORDER}
            >
              {openingPortal ? "Opening…" : "Stripe Billing Portal ↗"}
            </button>
          ) : null}
        </div>
      </header>

      {/* Ignite-admin Stripe readiness diagnostics (boolean flags only) */}
      {ov.isIgniteAdmin && readiness ? (
        <section
          className="rounded-xl p-5 space-y-4"
          style={{
            background: "var(--spark-surface)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-wider mono"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Admin Billing Readiness & Test Mode
              </p>
              <p className="text-sm mt-1 max-w-3xl" style={META}>
                Client-facing Plans & Billing stays hidden
                {readiness.clientBillingHidden
                  ? " (CLIENT_BILLING_LAUNCHED=false)."
                  : "."}{" "}
                Stripe {readiness.billingMode.toUpperCase()} · webhook{" "}
                <span className="mono text-[11px]">
                  {readiness.webhookEndpointUrl}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={runningBillingCheck || readiness.billingMode !== "test"}
              onClick={handleRunBillingTestCheck}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{
                background: "var(--pilot-cta-bg)",
                color: "var(--pilot-cta-fg)",
              }}
            >
              {runningBillingCheck
                ? "Running check…"
                : "Run Test-Mode Billing Check"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {readinessFlags.map((flag) => (
              <span
                key={flag.label}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold mono"
                style={{
                  background: flag.ok
                    ? "var(--pilot-ok-bg)"
                    : "var(--pilot-danger-bg)",
                  color: flag.ok
                    ? "var(--pilot-ok-fg)"
                    : "var(--pilot-danger-fg)",
                  border: flag.ok
                    ? "1px solid var(--pilot-ok-border)"
                    : "1px solid var(--pilot-danger-border)",
                }}
              >
                {flag.label}: {flag.ok ? "configured" : "missing"}
              </span>
            ))}
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold mono"
              style={{
                background: readiness.testSimulationActive
                  ? "var(--pilot-neutral-bg)"
                  : "var(--pilot-ok-bg)",
                color: readiness.testSimulationActive
                  ? "var(--pilot-neutral-fg)"
                  : "var(--pilot-ok-fg)",
              }}
            >
              {readiness.testSimulationActive
                ? "Local test simulator"
                : "Remote Stripe test API"}
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3 text-xs" style={META}>
            <div>
              Recent webhooks (30d):{" "}
              <strong style={{ color: "var(--spark-text)" }}>
                {readiness.recentWebhookCount}
              </strong>
            </div>
            <div>
              Failed:{" "}
              <strong style={{ color: "var(--spark-text)" }}>
                {readiness.failedWebhookCount}
              </strong>
            </div>
            <div>
              Last:{" "}
              <strong style={{ color: "var(--spark-text)" }}>
                {readiness.lastWebhookEventType || "—"}
                {readiness.lastWebhookStatus
                  ? ` (${readiness.lastWebhookStatus})`
                  : ""}
              </strong>
            </div>
          </div>

          {readiness.recentWebhooks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={META}>
                    <th className="py-1.5 pr-3 font-semibold">Event</th>
                    <th className="py-1.5 pr-3 font-semibold">Status</th>
                    <th className="py-1.5 pr-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.recentWebhooks.slice(0, 5).map((ev) => (
                    <tr
                      key={ev.stripeEventId}
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <td className="py-1.5 pr-3 mono">{ev.eventType}</td>
                      <td className="py-1.5 pr-3">{ev.processingStatus}</td>
                      <td className="py-1.5 pr-3" style={META}>
                        {ev.processedAt.slice(0, 19).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Pilot / Payment Failure / Paid-Through Alerts */}
      {ov.isPilot ? (
        <section
          className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
          style={{
            background: "var(--pilot-ok-bg)",
            border: "1px solid var(--pilot-ok-border)",
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mono" style={{ color: "var(--pilot-ok-fg)" }}>
              Active $1,500 · 60-Day Pro Pilot Entitlement
            </p>
            <p className="text-sm font-medium mt-0.5">
              {formatPilotCountdown(ov.pilotEndsAt)} · Includes 100 completed visits/month & full Pro cost, finance, POS, and store action workflows.
            </p>
            <p className="text-xs mt-0.5" style={META}>
              No automatic recurring charges will start when your pilot ends unless a brand admin explicitly confirms a recurring plan below.
            </p>
          </div>
        </section>
      ) : null}

      {ov.hasPaymentFailure ? (
        <section
          className="rounded-xl p-4 space-y-1"
          style={{
            background: "var(--pilot-danger-bg)",
            border: "1px solid var(--pilot-danger-border)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mono" style={{ color: "var(--pilot-danger-fg)" }}>
            Renewal Payment Action Required
          </p>
          <p className="text-sm font-medium">
            {ov.paymentFailureMessage || "Your latest subscription renewal payment failed."}
          </p>
          <p className="text-xs" style={META}>
            Your historical visits, recaps, and in-progress fieldwork remain safe and accessible. Update your payment method in the Stripe Billing Portal.
          </p>
        </section>
      ) : null}

      {ov.cancelAtPeriodEnd && ov.paidThroughAt ? (
        <section
          className="rounded-xl p-4"
          style={{
            background: "var(--pilot-warn-bg)",
            border: "1px solid var(--pilot-warn-border)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mono" style={{ color: "var(--pilot-warn-fg)" }}>
            Scheduled Cancellation · Paid-Through Access Preserved
          </p>
          <p className="text-sm mt-0.5">
            Your workspace retains full <strong>{ov.planDisplayName}</strong> features through{" "}
            <strong className="mono">{ov.paidThroughAt.slice(0, 10)}</strong>, then transitions cleanly to the Free tier (5 visits/month) with all historical data preserved.
          </p>
        </section>
      ) : null}

      {/* Open Stripe Test Mode Checkout Confirmation Banner */}
      {pendingTestSessionId && ov.stripeMode === "test" && ov.canManageBilling ? (
        <section
          className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: "var(--pilot-info-bg)",
            border: "1px solid var(--pilot-info-border)",
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mono" style={{ color: "var(--pilot-info-fg)" }}>
              Stripe Test Mode Hosted Checkout Ready ({pendingTestSessionId})
            </p>
            <p className="text-sm mt-1">
              {activeOpenCheckout?.effectiveSummary ||
                "Click Confirm Test Payment to dispatch a signed HMAC checkout.session.completed webhook and activate your plan."}
            </p>
          </div>
          <button
            type="button"
            disabled={completingTest}
            onClick={() => handleCompleteTestWebhook(pendingTestSessionId)}
            className="px-4 py-2.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--pilot-cta-bg)", color: "var(--pilot-cta-fg)" }}
          >
            {completingTest ? "Verifying Webhook…" : "Confirm Test Payment (Signed Webhook) →"}
          </button>
        </section>
      ) : null}

      {banner ? (
        <div
          className="rounded-xl px-4 py-3 text-xs font-medium"
          style={{
            background: "var(--pilot-ok-bg)",
            color: "var(--pilot-ok-fg)",
            border: "1px solid var(--pilot-ok-border)",
          }}
        >
          {banner}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-xl px-4 py-3 text-xs font-medium"
          style={{
            background: "var(--pilot-danger-bg)",
            color: "var(--pilot-danger-fg)",
            border: "1px solid var(--pilot-danger-border)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Monthly Canonical Visit Meter */}
      <section className="rounded-xl p-6 space-y-5" style={BORDER}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider mono" style={META}>
              Monthly Visit Meter · Billing Period {usage.monthKey} ({usage.businessTimezone})
            </p>
            <h2 className="display text-xl font-bold mt-1">
              {meter.summaryLabel}
            </h2>
            <p className="text-xs mt-0.5" style={META}>
              {meter.remainingLabel}
            </p>
          </div>

          <span
            className="px-3 py-1 rounded-full text-xs font-semibold mono"
            style={{
              background: "var(--pilot-ok-bg)",
              color: "var(--pilot-ok-fg)",
              border: "1px solid var(--pilot-ok-border)",
            }}
          >
            In-progress fieldwork is never blocked at cap
          </span>
        </div>

        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: "var(--pilot-meter-track)" }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${meter.percent}%`,
              background: meter.barColor,
            }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg p-3" style={BORDER}>
            <p className="text-[11px] mono" style={META}>Canonical Completed</p>
            <p className="display text-xl font-bold mt-0.5">
              {usage.completedVisitsUsed}
            </p>
          </div>
          <div className="rounded-lg p-3" style={BORDER}>
            <p className="text-[11px] mono" style={META}>In-Progress / Pending Review</p>
            <p className="display text-xl font-bold mt-0.5">
              {usage.inProgressOrPendingCount}
            </p>
          </div>
          <div className="rounded-lg p-3" style={BORDER}>
            <p className="text-[11px] mono" style={META}>Historical Backfill (Excluded)</p>
            <p className="display text-xl font-bold mt-0.5">
              {usage.historicalExcludedCount}
            </p>
          </div>
          <div className="rounded-lg p-3" style={BORDER}>
            <p className="text-[11px] mono" style={META}>Co-Branded Visits</p>
            <p className="display text-xl font-bold mt-0.5">
              {usage.coBrandedVisitCount}
            </p>
          </div>
        </div>

        {/* Schedule New Standalone Visit (demonstrates live cap gate + upgrade CTA) */}
        <form
          onSubmit={handleScheduleVisit}
          className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <label className="md:col-span-2 space-y-1">
            <span className="text-xs font-medium">Schedule New Standalone Visit</span>
            <input
              type="text"
              required
              value={schedStore}
              onChange={(e) => setSchedStore(e.target.value)}
              placeholder="e.g., FreshMart #108"
              className="w-full rounded-lg px-3 py-2 text-xs bg-transparent"
              style={BORDER}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">City / State</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={schedCity}
                onChange={(e) => setSchedCity(e.target.value)}
                className="w-2/3 rounded-lg px-2.5 py-2 text-xs bg-transparent"
                style={BORDER}
              />
              <input
                type="text"
                value={schedState}
                onChange={(e) => setSchedState(e.target.value)}
                maxLength={2}
                className="w-1/3 rounded-lg px-2 py-2 text-xs bg-transparent uppercase"
                style={BORDER}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Visit Date</span>
            <input
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs bg-transparent"
              style={BORDER}
            />
          </label>
          <button
            type="submit"
            disabled={schedulingVisit}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: "var(--pilot-cta-bg)", color: "var(--pilot-cta-fg)" }}
          >
            {schedulingVisit ? "Booking…" : "Schedule Visit →"}
          </button>
        </form>

        {mintedVisitLink ? (
          <div className="text-xs mono" style={{ color: "var(--pilot-ok-fg)" }}>
            Mobile recap link minted: {mintedVisitLink}
          </div>
        ) : null}

        {usage.countedVisits.length > 0 ? (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ ...META, borderBottom: "1px solid var(--spark-border)" }}>
                  <th className="py-2 pr-3">Store / Venue</th>
                  <th className="py-2 pr-3">Visit Date</th>
                  <th className="py-2 pr-3">Completed ({usage.businessTimezone})</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Deduplicated Sources</th>
                  <th className="py-2 pr-3">Co-Brand Share</th>
                  <th className="py-2 text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {usage.countedVisits.map((cv) => (
                  <tr
                    key={cv.visitUuid}
                    style={{ borderBottom: "1px solid var(--spark-hairline)" }}
                  >
                    <td className="py-2.5 pr-3 font-medium">{cv.storeLabel}</td>
                    <td className="py-2.5 pr-3 mono">{cv.visitDate}</td>
                    <td className="py-2.5 pr-3 mono">{cv.completionLocalDate}</td>
                    <td className="py-2.5 pr-3">{cv.providerName || "Internal Team"}</td>
                    <td className="py-2.5 pr-3 mono">
                      {cv.submissionCount} source{cv.submissionCount === 1 ? "" : "s"} → 1 visit
                    </td>
                    <td className="py-2.5 pr-3 mono">
                      {cv.coBrandSharePct ? `${cv.coBrandSharePct}%` : "100%"}
                    </td>
                    <td className="py-2.5 text-right">
                      {ov.canManageBilling ? (
                        <button
                          type="button"
                          disabled={reversingVisit}
                          onClick={() => handleReverseVisit(cv.visitUuid)}
                          className="text-[11px] underline opacity-75 hover:opacity-100"
                        >
                          Reverse
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Plan Comparison Cards */}
      <section className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Transparent Monthly Tiers · Configurable Catalog & Volume Bands
          </p>
          <h2 className="display text-xl font-bold mt-1">
            Compare Spark Software Plans
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ov.availablePlans.map((plan) => {
            const isCurrent = plan.isCurrent;
            return (
              <div
                key={plan.planCode}
                className="rounded-xl p-5 flex flex-col justify-between space-y-4"
                style={{
                  border: isCurrent
                    ? "1.5px solid var(--pilot-ok-border)"
                    : "1px solid var(--spark-border)",
                  background: isCurrent
                    ? "var(--pilot-ok-subtle)"
                    : "var(--spark-surface)",
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="display text-lg font-bold">
                      {plan.displayName}
                    </h3>
                    {isCurrent ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold mono"
                        style={{
                          background: "var(--pilot-cta-bg)",
                          color: "var(--pilot-cta-fg)",
                        }}
                      >
                        CURRENT
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <span className="display text-2xl font-bold mono">
                      {plan.isQuoteOnly ? "From " : ""}${Number(plan.monthlyPriceUsd).toLocaleString("en-US")}
                    </span>
                    <span className="text-xs ml-1" style={META}>
                      / month
                    </span>
                    <p className="text-xs font-semibold mono mt-1" style={{ color: "var(--pilot-ok-fg)" }}>
                      {plan.includedCompletedVisits != null
                        ? `${plan.includedCompletedVisits} completed visits / mo`
                        : "Contracted SOW visits"}
                    </p>
                  </div>

                  <p className="text-xs" style={META}>
                    {plan.tagline}
                  </p>

                  <ul
                    className="space-y-1.5 text-xs pt-2"
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <li>
                      • Operating providers:{" "}
                      <strong>{plan.maxOperatingProviders ?? "Unlimited"}</strong>
                    </li>
                    <li>
                      • Active programs:{" "}
                      <strong>{plan.maxActivePrograms ?? "Unlimited"}</strong>
                    </li>
                    <li>
                      • Ongoing agency CSV imports:{" "}
                      <strong>{plan.allowsProviderCsvImports ? "Included" : "—"}</strong>
                    </li>
                    <li>
                      • Store recommendations & exports:{" "}
                      <strong>{plan.allowsStoreRecommendations ? "Included" : "—"}</strong>
                    </li>
                    <li>
                      • POS lift & ROI:{" "}
                      <strong>
                        {plan.allowsRetailerPosMeasurement
                          ? plan.maxPosRetailers != null
                            ? `Up to ${plan.maxPosRetailers} retailer${plan.maxPosRetailers === 1 ? "" : "s"}`
                            : "Multi-retailer"
                          : "—"}
                      </strong>
                    </li>
                    <li>
                      • Demo costs, Finance queue & Rebook/Hold/Restock:{" "}
                      <strong>{plan.allowsBrandCostTracking ? "Included" : "—"}</strong>
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-lg text-xs font-bold opacity-60"
                      style={BORDER}
                    >
                      Active Plan
                    </button>
                  ) : plan.isQuoteOnly ? (
                    <a
                      href="mailto:growth@igniteproductions.co?subject=Spark%20Scale%20Plan%20Quote"
                      className="block text-center w-full py-2 rounded-lg text-xs font-bold"
                      style={BORDER}
                    >
                      Request Scale Quote →
                    </a>
                  ) : ov.canManageBilling ? (
                    <button
                      type="button"
                      disabled={loadingPreview}
                      onClick={() => void openPlanChangeModal(plan.planCode)}
                      className="w-full py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                      style={{
                        background: "var(--pilot-cta-bg)",
                        color: "var(--pilot-cta-fg)",
                      }}
                    >
                      {Number(plan.monthlyPriceUsd) > Number(ov.monthlyPriceUsd)
                        ? `Upgrade to ${plan.displayName} →`
                        : `Switch to ${plan.displayName}`}
                    </button>
                  ) : (
                    <p className="text-[11px] text-center" style={META}>
                      Ask a Brand Admin to change plan
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customer-Approved Volume Band / Cancellation / Admin Pilot Controls */}
      {ov.canManageBilling ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveVolumeBand}
            className="rounded-xl p-5 space-y-3"
            style={BORDER}
          >
            <p className="text-xs uppercase tracking-wider mono" style={META}>
              Explicit Volume Band & Overage Consent
            </p>
            <h3 className="display text-base font-bold">
              Never charged overages without explicit approval
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs space-y-1">
                <span style={META}>Agreed Monthly Visit Band</span>
                <input
                  type="number"
                  min={5}
                  value={bandVisits}
                  onChange={(e) => setBandVisits(e.target.value)}
                  className="block w-36 rounded-lg px-3 py-1.5 text-xs bg-transparent mono"
                  style={BORDER}
                />
              </label>
              <label className="flex items-center gap-2 text-xs pt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overageApproved}
                  onChange={(e) => setOverageApproved(e.target.checked)}
                  style={{ accentColor: "var(--pilot-control-accent)" }}
                />
                <span>Approve $12/visit metered overage above band</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={savingVolume}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
              style={BORDER}
            >
              Save Volume Preferences
            </button>
          </form>

          <div className="rounded-xl p-5 space-y-3" style={BORDER}>
            <p className="text-xs uppercase tracking-wider mono" style={META}>
              Cancellation & Pilot Controls
            </p>
            {ov.effectivePlanCode !== "free" &&
            !ov.isManagedSow &&
            !ov.cancelAtPeriodEnd ? (
              <div className="space-y-2">
                <p className="text-xs" style={META}>
                  Cancelling stops future renewals while preserving paid features through the end of your current billing period.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancelling (optional)"
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs bg-transparent"
                    style={BORDER}
                  />
                  <button
                    type="button"
                    disabled={cancellingSub}
                    onClick={handleCancelAtPeriodEnd}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: "var(--pilot-danger-bg)",
                      color: "var(--pilot-danger-fg)",
                      border: "1px solid var(--pilot-danger-border)",
                    }}
                  >
                    Cancel at Period End
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={META}>
                {ov.isManagedSow
                  ? "Managed SOW workspaces preserve contracted Ignite SOW entitlements."
                  : ov.cancelAtPeriodEnd
                    ? `Cancellation scheduled — paid access continues through ${ov.paidThroughAt?.slice(0, 10) || "period end"}.`
                    : "You are on the $0 Free plan — no recurring charges active."}
              </p>
            )}

            {ov.isIgniteAdmin ? (
              <div
                className="pt-3 flex flex-wrap items-center justify-between gap-2"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <span className="text-xs mono" style={META}>
                  Ignite Staff · Provision $1,500 / 60-Day Pro Pilot
                </span>
                <button
                  type="button"
                  disabled={provisioningPilot}
                  onClick={handleProvisionPilot}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: "var(--pilot-cta-bg)",
                    color: "var(--pilot-cta-fg)",
                  }}
                >
                  Provision 60-Day Pro Pilot
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Pre-Confirmation Disclosure Modal */}
      {previewModal ? (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="max-w-lg w-full rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--spark-surface)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-xs uppercase tracking-wider mono font-semibold"
                style={{ color: "var(--pilot-ok-fg)" }}
              >
                Confirm Plan & Billing Terms
              </p>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="text-xs hover:opacity-100 opacity-80"
                style={META}
              >
                Close ✕
              </button>
            </div>

            <h3 className="display text-xl font-bold">
              {previewModal.targetDisplayName} · ${previewModal.monthlyPriceUsd}/month
            </h3>

            <div
              className="rounded-xl p-3.5 space-y-1.5 text-xs"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <p>
                <span style={META}>Charge today:</span>{" "}
                <strong className="mono">${previewModal.chargeTodayUsd} USD</strong>
              </p>
              <p>
                <span style={META}>Monthly allowance:</span>{" "}
                <strong className="mono">{previewModal.includedVisits} canonical completed visits/month</strong>
              </p>
              <p>
                <span style={META}>Effective timing:</span>{" "}
                <strong>{previewModal.effectiveDateLabel}</strong>
              </p>
              <p className="pt-1" style={{ color: "var(--spark-text-secondary)" }}>
                {previewModal.disclosure}
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: "var(--pilot-control-accent)" }}
              />
              <span>
                I confirm the recurring software subscription terms, effective date, and monthly visit allowance above.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={BORDER}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!termsChecked || startingCheckout || changingPlan}
                onClick={handleConfirmPlanAction}
                className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{
                  background: "var(--pilot-cta-bg)",
                  color: "var(--pilot-cta-fg)",
                }}
              >
                {startingCheckout || changingPlan
                  ? "Processing…"
                  : `Confirm ${previewModal.targetDisplayName} →`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const PlansAndBillingPage: React.FC = () => {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm" style={META}>
          Loading plans, visit meter & billing…
        </div>
      }
    >
      <PlansAndBillingBody
        fetchKey={fetchKey}
        bump={() => setFetchKey((k) => k + 1)}
      />
    </Suspense>
  );
};

export default PlansAndBillingPage;
