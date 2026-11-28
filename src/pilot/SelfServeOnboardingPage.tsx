import React, { Suspense, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { fetchQuery, commitMutation } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { TenantQuery } from "@/api/queries/TenantQuery";
import { rememberTenantRecent } from "@/layout/tenantPickerPrefs";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import {
  providerSubmitUrl,
  workspaceSharePublicUrl,
} from "@/utils/publicHosts";
import {
  applyWorkspaceContextSelection,
  createInitialOnboardingSignupState,
  currentDateInTimezone,
  planBadgeMeta,
  validateOnboardingQuickRecap,
} from "./pilotHelpers";
import {
  captureOnboardingMarketingUtm,
  utmMutationVariables,
} from "./marketingUtm";
import { StepTrack, StrokeCheckBadge } from "@/motion/ProgressMoments";
import { PasswordStrengthMeter } from "@/motion/PasswordStrengthMeter";
import { PlanPickerCard } from "@/motion/PlanAndTideMoments";
import {
  PilotQueriesOnboardingStateQuery,
  PilotQueriesStarterCatalogQuery,
} from "@/api/queries/PilotQueries";
import {
  PilotMutationsApproveCanonicalVisitMutation,
  PilotMutationsOnboardingInviteContributorMutation,
  PilotMutationsSelectStarterProgramMutation,
  PilotMutationsStartSelfServeOnboardingMutation,
} from "@/api/mutations/PilotMutations";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import type { PilotQueriesStarterCatalogQuery as CatalogQueryType } from "@/api/queries/__generated__/PilotQueriesStarterCatalogQuery.graphql";
import type { PilotQueriesOnboardingStateQuery as OnboardingStateQueryType } from "@/api/queries/__generated__/PilotQueriesOnboardingStateQuery.graphql";
import type { PilotMutationsStartSelfServeOnboardingMutation as StartOnboardingMutationType } from "@/api/mutations/__generated__/PilotMutationsStartSelfServeOnboardingMutation.graphql";
import type { PilotMutationsSelectStarterProgramMutation as SelectStarterMutationType } from "@/api/mutations/__generated__/PilotMutationsSelectStarterProgramMutation.graphql";
import type { PilotMutationsOnboardingInviteContributorMutation as InviteContributorMutationType } from "@/api/mutations/__generated__/PilotMutationsOnboardingInviteContributorMutation.graphql";
import type { PilotMutationsApproveCanonicalVisitMutation as ApproveVisitMutationType } from "@/api/mutations/__generated__/PilotMutationsApproveCanonicalVisitMutation.graphql";

const TIMEZONE_OPTIONS = [
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
] as const;

function apiBaseUrl(): string {
  const gql = (import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined) ?? "";
  try {
    return new URL(gql).origin;
  } catch {
    return "";
  }
}

async function loadSwitchableTenants(
  userUuid?: string | null,
): Promise<SwitchableTenant[]> {
  const data = await fetchQuery<TenantQueryType>(
    environment,
    TenantQuery,
    userUuid ? { userUuid } : {},
    { fetchPolicy: "network-only" },
  ).toPromise();
  return (data?.tenants?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({
      id: n.id,
      uuid: String(n.uuid),
      name: n.name ?? null,
      logo: n.image ?? null,
      requestUrlName: n.requestUrlName ?? null,
      tenantSlug: n.tenantSlug ?? null,
      checkinCode: n.checkinCode ?? null,
    }));
}

const UnauthenticatedSignupStep: React.FC<{
  onAuthenticated: () => void;
}> = ({ onAuthenticated }) => {
  const [searchParams] = useSearchParams();
  const invitationToken = (
    searchParams.get("invitation_token") ||
    searchParams.get("invite") ||
    searchParams.get("invitation") ||
    ""
  ).trim();
  const marketingUtm = captureOnboardingMarketingUtm(searchParams);

  const catalogData = useLazyLoadQuery<CatalogQueryType>(
    PilotQueriesStarterCatalogQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const catalog = catalogData.selfServeStarterCatalog;

  const initialSignup = createInitialOnboardingSignupState();
  const [firstName, setFirstName] = useState(initialSignup.firstName);
  const [lastName, setLastName] = useState(initialSignup.lastName);
  const [email, setEmail] = useState(initialSignup.email);
  const [password, setPassword] = useState(initialSignup.password);
  const [brandName, setBrandName] = useState(initialSignup.brandName);
  const [businessTimezone, setBusinessTimezone] = useState(
    initialSignup.businessTimezone,
  );
  const [acceptTerms, setAcceptTerms] = useState(initialSignup.acceptTerms);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!catalog.signupEnabled) {
      setError("Self-service signup is currently disabled.");
      return;
    }
    if (!acceptTerms) {
      setError("Please review and accept the Spark Terms of Service to continue.");
      return;
    }
    setSubmitting(true);
    const utmVars = utmMutationVariables(marketingUtm);
    commitMutation<StartOnboardingMutationType>(environment, {
      mutation: PilotMutationsStartSelfServeOnboardingMutation,
      variables: {
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        brandName: brandName.trim(),
        businessTimezone,
        acceptTerms,
        forceNewWorkspace: false,
        invitationToken,
        ...utmVars,
        landingPath: "/onboarding",
      },
      onCompleted: async (resp) => {
        const out = resp.startSelfServeOnboarding;
        if (!out.ok || !out.token || !out.tenantUuid) {
          setError(out.error || "Could not create or resume your workspace.");
          setSubmitting(false);
          return;
        }
        try {
          await useAuthStore
            .getState()
            .socialLogin(out.token, out.refreshToken || "");
          await applyWorkspaceContextSelection(
            {
              membershipUuid: out.membershipUuid,
              tenantUuid: out.tenantUuid,
              tenantSlug: out.tenantSlug,
              workspaceRole: out.workspaceRole || "brand_admin",
            },
            {
              store: useAuthStore.getState(),
              loadTenants: loadSwitchableTenants,
              rememberRecent: rememberTenantRecent,
            },
          );
          onAuthenticated();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setSubmitting(false);
        }
      },
      onError: (err) => {
        setError(err.message);
        setSubmitting(false);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-7 rounded-2xl p-6 md:p-8 space-y-5"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      >
        <div>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold mono"
            style={{
              background: "var(--pilot-ok-bg)",
              color: "var(--pilot-ok-fg)",
              border: "1px solid var(--pilot-ok-border)",
            }}
          >
            Free Tier · 5 Visits / Month · No Credit Card Required
          </span>
          <h2 className="display text-2xl font-bold mt-3">
            Use Spark with your team
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--spark-text-meta)" }}>
            Launch a standalone brand workspace in 60 seconds, or enter an existing account to resume setup without creating duplicate workspaces.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Maya"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Lin"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>Work email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maya@canyonspritz.com"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>Password (8+ chars) *</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            />
            <PasswordStrengthMeter password={password} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>Brand / Company name *</span>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Canyon Spritz Co."
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: "var(--spark-text-secondary)" }}>Metering timezone</span>
            <select
              value={businessTimezone}
              onChange={(e) => setBusinessTimezone(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--spark-field-bg, var(--spark-bg))",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label
          className="flex items-start gap-2.5 text-xs cursor-pointer"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: "var(--pilot-control-accent)" }}
          />
          <span>
            I agree to the Spark Terms of Service. My workspace starts on the{" "}
            <strong style={{ color: "var(--spark-text)" }}>Free plan ($0/month · 5 completed visits/month)</strong>{" "}
            with zero automatic charges.
          </span>
        </label>

        {error ? (
          <div
            className="rounded-lg px-3.5 py-2.5 text-xs font-medium"
            style={{
              background: "var(--pilot-danger-bg)",
              color: "var(--pilot-danger-fg)",
              border: "1px solid var(--pilot-danger-border)",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || !acceptTerms}
            className="px-5 py-2.5 rounded-lg text-sm font-bold transition-opacity disabled:opacity-50"
            style={{
              background: "var(--pilot-cta-bg)",
              color: "var(--pilot-cta-fg)",
            }}
          >
            {submitting ? "Creating Workspace…" : "Create Free Workspace →"}
          </button>

          <Link
            to="/login"
            className="text-xs underline hover:opacity-100 opacity-85"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </form>

      <aside
        className="lg:col-span-5 rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mono" style={{ color: "var(--spark-text-meta)" }}>
          Included CPG Starter Templates
        </p>
        <div className="space-y-3">
          {catalog.starters.map((s) => (
            <div
              key={s.key}
              className="rounded-xl p-3.5 space-y-1"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>{s.description}</p>
              <p className="text-[11px] mono font-medium" style={{ color: "var(--pilot-ok-fg)" }}>
                Template: {s.templateName} · Default SKU: {s.defaultSkuHint}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

const AuthenticatedOnboardingWizard: React.FC<{
  fetchKey: number;
  bump: () => void;
}> = ({ fetchKey, bump }) => {
  const navigate = useNavigate();
  const { isAdmin, canToggleRole } = useSparkRole();
  const showBillingLinks = canToggleRole && isAdmin;
  const data = useLazyLoadQuery<OnboardingStateQueryType>(
    PilotQueriesOnboardingStateQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const st = data.onboardingState;
  const planBadge = planBadgeMeta(st.planCode);

  const [commitStarter, savingStarter] = useMutation<SelectStarterMutationType>(
    PilotMutationsSelectStarterProgramMutation,
  );
  const [commitInvite, savingInvite] = useMutation<InviteContributorMutationType>(
    PilotMutationsOnboardingInviteContributorMutation,
  );
  const [commitApprove, savingApprove] = useMutation<ApproveVisitMutationType>(
    PilotMutationsApproveCanonicalVisitMutation,
  );

  const [selectedKey, setSelectedKey] = useState(
    st.starterTemplateKey || "beverage_retail_demo",
  );
  const [customProgramName, setCustomProgramName] = useState(
    st.starterProgramName || "",
  );
  const [starterSkuName, setStarterSkuName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("field_contributor");
  const [inviteProviderName, setInviteProviderName] = useState("");

  // Quick field submission helper for first visit without Ignite staffing (starts empty — never pre-fills fabricated KPIs)
  const [quickStore, setQuickStore] = useState("");
  const [quickCity, setQuickCity] = useState("");
  const [quickState, setQuickState] = useState("");
  const [quickVisitDate, setQuickVisitDate] = useState(() =>
    currentDateInTimezone(st.businessTimezone),
  );
  const [quickSamples, setQuickSamples] = useState("");
  const [quickConsumers, setQuickConsumers] = useState("");
  const [quickUnits, setQuickUnits] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [submittingField, setSubmittingField] = useState(false);

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mobileUrl = st.submissionCode
    ? providerSubmitUrl(st.submissionCode)
    : null;
  const sharedUrl = st.firstSharedToken
    ? workspaceSharePublicUrl(st.firstSharedToken)
    : null;

  const handleSaveStarter = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    commitStarter({
      variables: {
        starterKey: selectedKey,
        customProgramName: customProgramName.trim(),
        starterSkuName: starterSkuName.trim(),
      },
      onCompleted: (res) => {
        const out = res.selectOnboardingStarterProgram;
        if (!out.ok) {
          setError(out.error || "Could not save starter program.");
          return;
        }
        setBanner(`Starter program & mobile recap link (${out.targetUuid}) ready.`);
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    commitInvite({
      variables: {
        email: inviteEmail.trim(),
        workspaceRole: inviteRole,
        providerName: inviteProviderName.trim(),
      },
      onCompleted: (res) => {
        const out = res.onboardingInviteContributor;
        if (!out.ok) {
          setError(out.error || "Could not send invite.");
          return;
        }
        setBanner(`Invited ${inviteEmail.trim()} (${out.status}) — repeat-safe & free seat.`);
        setInviteEmail("");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleQuickFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!st.submissionCode) {
      setError("Select a starter program in Step 2 first to mint your mobile recap link.");
      return;
    }
    const check = validateOnboardingQuickRecap(
      {
        storeName: quickStore,
        city: quickCity,
        stateCode: quickState,
        visitDate: quickVisitDate,
        samplesDistributed: quickSamples,
        consumersSampled: quickConsumers,
        repObservedUnits: quickUnits,
      },
      st.businessTimezone,
    );
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    setSubmittingField(true);
    try {
      const resp = await fetch(
        `${apiBaseUrl()}/api/public/provider-submit/${encodeURIComponent(st.submissionCode)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...check.payload,
            notes: quickNotes.trim(),
          }),
        },
      );
      const body = (await resp.json()) as { ok?: boolean; message?: string };
      if (!resp.ok || !body.ok) {
        setError(body.message || "Could not submit field recap.");
      } else {
        setQuickStore("");
        setQuickCity("");
        setQuickState("");
        setQuickSamples("");
        setQuickConsumers("");
        setQuickUnits("");
        setQuickNotes("");
        setBanner("Field recap submitted! Review & approve it below to complete your first visit.");
        bump();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingField(false);
    }
  };

  const handleApproveVisit = (visitUuid: string) => {
    setError(null);
    commitApprove({
      variables: { visitUuid },
      onCompleted: (res) => {
        const out = res.approveCanonicalVisitRecap;
        if (!out.ok) {
          setError(out.error || "Could not approve visit recap.");
          return;
        }
        setBanner("First visit approved! Shareable recap link minted without Ignite staff.");
        bump();
      },
      onError: (err) => setError(err.message),
    });
  };

  const steps = [
    { label: "Workspace created", done: st.stepWorkspaceCreated },
    { label: "Starter program & template", done: st.stepProgramSelected },
    { label: "Contributor invited (optional)", done: st.stepContributorInvited },
    { label: "Mobile field recap link", done: st.stepMobileLinkOpened },
    { label: "First visit approved & shared", done: st.stepFirstVisitCompleted },
  ];

  const inputStyle = {
    background: "var(--spark-field-bg, var(--spark-bg))",
    color: "var(--spark-text)",
    border: "1px solid var(--spark-border)",
  } as const;

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold mono"
              style={{ background: planBadge.bg, color: planBadge.fg }}
            >
              {planBadge.label} · {st.completedVisitsUsed}/{st.includedVisits ?? "∞"} visits used
            </span>
            <span className="text-xs mono" style={{ color: "var(--spark-text-meta)" }}>
              Timezone: {st.businessTimezone}
            </span>
          </div>
          <h2 className="display text-2xl font-bold mt-2">
            {st.tenantName} · Self-Service Launch Checklist ({st.stepsCompleted}/{st.totalSteps})
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/workspace")}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold hover:opacity-90"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Open Workspace →
          </button>
          {showBillingLinks ? (
            <button
              type="button"
              onClick={() => navigate("/plans-billing")}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{
                background: "var(--pilot-cta-bg)",
                color: "var(--pilot-cta-fg)",
              }}
            >
              Plans & Visit Meter →
            </button>
          ) : null}
        </div>
      </div>

      {(() => {
        const firstPendingIdx = steps.findIndex((s) => !s.done);
        return (
          <div className="space-y-3">
            <div
              className="hidden md:block rounded-xl px-4 py-3"
              style={{
                background: "var(--spark-surface)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <StepTrack
                ariaLabel="Onboarding launch progress"
                accent="var(--spark-lime)"
                steps={steps.map((step, i) => ({
                  key: step.label,
                  label: step.label,
                  state: step.done
                    ? "done"
                    : i === firstPendingIdx
                      ? "current"
                      : "upcoming",
                }))}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              {steps.map((step, i) => (
                <div
                  key={step.label}
                  className="rounded-xl px-3.5 py-3 text-xs"
                  style={{
                    background: step.done ? "var(--pilot-ok-bg)" : "var(--spark-surface)",
                    border: step.done
                      ? "1px solid var(--pilot-ok-border)"
                      : "1px solid var(--spark-border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="mono font-bold"
                      style={{
                        color: step.done ? "var(--pilot-ok-fg)" : "var(--spark-text-meta)",
                      }}
                    >
                      STEP {i + 1} · {step.done ? "DONE" : "NEXT"}
                    </p>
                    <StrokeCheckBadge
                      done={step.done}
                      current={!step.done && i === firstPendingIdx}
                      index={i}
                      accent="var(--spark-lime)"
                      size={18}
                    />
                  </div>
                  <p className="font-medium mt-1" style={{ color: "var(--spark-text)" }}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 2: Starter Program */}
        <form
          onSubmit={handleSaveStarter}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "var(--spark-surface)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider mono font-semibold" style={{ color: "var(--pilot-ok-fg)" }}>
              Step 2 · Starter Program & Recap Template
            </p>
            <h3 className="display text-lg font-bold mt-1">
              Choose your field activation format
            </h3>
          </div>

          <div className="space-y-2" role="radiogroup" aria-label="Starter program format">
            {st.starters.map((opt) => (
              <PlanPickerCard
                key={opt.key}
                compact
                selected={selectedKey === opt.key}
                onSelect={() => setSelectedKey(opt.key)}
                title={opt.name}
                subtitle={opt.description}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={customProgramName}
              onChange={(e) => setCustomProgramName(e.target.value)}
              placeholder="Custom program title (optional)"
              className="rounded-lg px-3 py-2 text-xs"
              style={inputStyle}
            />
            <input
              type="text"
              value={starterSkuName}
              onChange={(e) => setStarterSkuName(e.target.value)}
              placeholder="Flagship SKU name (optional)"
              className="rounded-lg px-3 py-2 text-xs"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={savingStarter}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{
              background: "var(--pilot-cta-bg)",
              color: "var(--pilot-cta-fg)",
            }}
          >
            {savingStarter
              ? "Provisioning…"
              : st.stepProgramSelected
                ? "Update Starter Program"
                : "Provision Starter Program & Link →"}
          </button>
        </form>

        {/* Step 3: Invite Field Rep / Agency */}
        <form
          onSubmit={handleInvite}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "var(--spark-surface)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider mono font-semibold" style={{ color: "var(--pilot-ok-fg)" }}>
              Step 3 · Optional Team or Agency Invite
            </p>
            <h3 className="display text-lg font-bold mt-1">
              Invite a field contributor or viewer (Free seat)
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
              Field contributors and read-only viewers are always free. Repeating an invite safely reuses the existing token.
            </p>
          </div>

          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="rep@agency-or-team.com"
            className="w-full rounded-lg px-3 py-2 text-xs"
            style={inputStyle}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs"
              style={inputStyle}
            >
              <option value="field_contributor">Field Contributor (Free)</option>
              <option value="provider_manager">Agency / Provider Manager</option>
              <option value="brand_viewer">Read-Only Brand Viewer (Free)</option>
              <option value="brand_reviewer">Brand Ops / Reviewer</option>
            </select>
            <input
              type="text"
              value={inviteProviderName}
              onChange={(e) => setInviteProviderName(e.target.value)}
              placeholder="Team / Agency name (optional)"
              className="rounded-lg px-3 py-2 text-xs"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={savingInvite}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            {savingInvite ? "Sending Invite…" : "Send Contributor Invite"}
          </button>
        </form>
      </div>

      {/* Step 4 & 5: Mobile Recap Link + First Visit Approval & Share Link */}
      <section
        className="rounded-2xl p-6 space-y-5"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider mono font-semibold" style={{ color: "var(--pilot-ok-fg)" }}>
              Steps 4 & 5 · Mobile Field Recap & Self-Service Approval
            </p>
            <h3 className="display text-lg font-bold mt-1">
              Complete your first visit & shareable recap without Ignite staffing
            </h3>
          </div>

          {mobileUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code
                className="px-3 py-1.5 rounded-lg text-xs mono"
                style={{
                  background: "var(--pilot-ok-bg)",
                  color: "var(--pilot-ok-fg)",
                  border: "1px solid var(--pilot-ok-border)",
                }}
              >
                {mobileUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(mobileUrl)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90"
                style={{
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                Copy Mobile Link
              </button>
              <a
                href={`/provider-submit/${encodeURIComponent(st.submissionCode || "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: "var(--pilot-cta-bg)",
                  color: "var(--pilot-cta-fg)",
                }}
              >
                Open Mobile Form ↗
              </a>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              Complete Step 2 above to mint your mobile field submission link.
            </p>
          )}
        </div>

        {st.submissionCode ? (
          <form
            onSubmit={handleQuickFieldSubmit}
            className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end pt-3"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <label className="md:col-span-2 space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Store / Venue *</span>
              <input
                type="text"
                required
                value={quickStore}
                onChange={(e) => setQuickStore(e.target.value)}
                placeholder="e.g. Store name & #"
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>City / State</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  placeholder="City"
                  className="w-2/3 rounded-lg px-2.5 py-2 text-xs"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={quickState}
                  onChange={(e) => setQuickState(e.target.value)}
                  placeholder="ST"
                  maxLength={2}
                  className="w-1/3 rounded-lg px-2 py-2 text-xs uppercase"
                  style={inputStyle}
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Visit Date ({st.businessTimezone}) *</span>
              <input
                type="date"
                required
                value={quickVisitDate}
                onChange={(e) => setQuickVisitDate(e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-xs"
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Samples *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickSamples}
                onChange={(e) => setQuickSamples(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Consumers *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickConsumers}
                onChange={(e) => setQuickConsumers(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Observed Units *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickUnits}
                onChange={(e) => setQuickUnits(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </label>
            <button
              type="submit"
              disabled={submittingField}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{
                background: "var(--pilot-cta-bg)",
                color: "var(--pilot-cta-fg)",
              }}
            >
              {submittingField ? "Submitting…" : "Log Field Recap"}
            </button>
            <label className="md:col-span-8 space-y-1">
              <span className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>Shift notes (optional)</span>
              <input
                type="text"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="Optional field notes from the visit"
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </label>
          </form>
        ) : null}

        {st.recentVisits.length > 0 ? (
          <div className="space-y-2 pt-2">
            <p className="text-xs uppercase tracking-wider mono" style={{ color: "var(--spark-text-meta)" }}>
              Submitted & Completed Workspace Visits
            </p>
            {st.recentVisits.map((v) => (
              <div
                key={v.uuid}
                className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {v.storeLabel}{" "}
                    <span className="text-xs font-normal" style={{ color: "var(--spark-text-meta)" }}>
                      · {v.visitDate} · {v.samplesDistributed ?? 0} samples · {v.repObservedUnits ?? 0} units
                    </span>
                  </p>
                  <p className="text-xs mono" style={{ color: "var(--spark-text-meta)" }}>
                    Status: {v.status} · Submissions linked: {v.submissionCount}
                  </p>
                </div>

                {v.status !== "completed" ? (
                  <button
                    type="button"
                    disabled={savingApprove}
                    onClick={() => handleApproveVisit(v.uuid)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: "var(--pilot-cta-bg)",
                      color: "var(--pilot-cta-fg)",
                    }}
                  >
                    Approve Recap & Mint Share Link →
                  </button>
                ) : (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold mono"
                    style={{
                      background: "var(--pilot-ok-bg)",
                      color: "var(--pilot-ok-fg)",
                      border: "1px solid var(--pilot-ok-border)",
                    }}
                  >
                    Approved & Counted
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {sharedUrl ? (
          <div
            className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
            style={{
              background: "var(--pilot-ok-bg)",
              border: "1px solid var(--pilot-ok-border)",
            }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mono" style={{ color: "var(--pilot-ok-fg)" }}>
                Shareable Recap Ready
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--spark-text)" }}>{sharedUrl}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(sharedUrl)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                Copy Share Link
              </button>
              <a
                href={`/workspace-share/${encodeURIComponent(st.firstSharedToken || "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: "var(--pilot-cta-bg)",
                  color: "var(--pilot-cta-fg)",
                }}
              >
                Preview Shared Recap ↗
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export const SelfServeOnboardingPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isAdmin, canToggleRole } = useSparkRole();
  const showBillingLinks = canToggleRole && isAdmin;
  const [fetchKey, setFetchKey] = useState(0);
  const bump = () => setFetchKey((k) => k + 1);

  return (
    <div
      className="min-h-[100dvh] py-8 px-4 md:px-8"
      style={{ background: "var(--spark-bg)", color: "var(--spark-text)" }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <header
          className="flex flex-wrap items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: "var(--pilot-brand-dot)" }}
            />
            <span className="display font-bold tracking-tight text-lg">
              SPARK BY IGNITE
            </span>
            <span className="text-xs mono" style={{ color: "var(--spark-text-meta)" }}>
              Standalone Brand Workspace Onboarding
            </span>
          </div>
          {isAuthenticated && showBillingLinks ? (
            <Link
              to="/plans-billing"
              className="text-xs font-semibold mono hover:underline"
              style={{ color: "var(--pilot-ok-fg)" }}
            >
              Plans, Usage Meter & Billing →
            </Link>
          ) : !isAuthenticated ? (
            <Link
              to="/login"
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Sign in to existing account →
            </Link>
          ) : (
            <Link
              to="/workspace"
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Open Workspace →
            </Link>
          )}
        </header>

        <Suspense
          fallback={
            <div className="py-12 text-sm" style={{ color: "var(--spark-text-meta)" }}>
              Loading workspace setup…
            </div>
          }
        >
          {isAuthenticated ? (
            <AuthenticatedOnboardingWizard fetchKey={fetchKey} bump={bump} />
          ) : (
            <UnauthenticatedSignupStep onAuthenticated={bump} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default SelfServeOnboardingPage;
