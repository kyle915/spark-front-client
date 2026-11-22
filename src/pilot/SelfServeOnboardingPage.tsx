import React, { Suspense, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { fetchQuery, commitMutation } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { TenantQuery } from "@/api/queries/TenantQuery";
import { rememberTenantRecent } from "@/layout/tenantPickerPrefs";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import {
  providerSubmitUrl,
  workspaceSharePublicUrl,
} from "@/utils/publicHosts";
import {
  applyWorkspaceContextSelection,
  currentDateInTimezone,
  planBadgeMeta,
} from "./pilotHelpers";
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
  const invitationToken =
    (
      searchParams.get("invitation_token") ||
      searchParams.get("invite") ||
      ""
    ).trim() || undefined;

  const catalogData = useLazyLoadQuery<CatalogQueryType>(
    PilotQueriesStarterCatalogQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const catalog = catalogData.selfServeStarterCatalog;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [businessTimezone, setBusinessTimezone] = useState("America/Chicago");
  const [acceptTerms, setAcceptTerms] = useState(false);
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
          background: "#111317",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <div>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold mono"
            style={{ background: "rgba(197,245,70,0.16)", color: "#c5f546" }}
          >
            Free Tier · 5 Visits / Month · No Credit Card Required
          </span>
          <h2 className="display text-2xl font-bold mt-3 text-white">
            Use Spark with your team
          </h2>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            Launch a standalone brand workspace in 60 seconds, or enter an existing account to resume setup without creating duplicate workspaces.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Maya"
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Lin"
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">Work email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maya@canyonspritz.com"
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">Password (8+ chars) *</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">Brand / Company name *</span>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Canyon Spritz Co."
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-300">Metering timezone</span>
            <select
              value={businessTimezone}
              onChange={(e) => setBusinessTimezone(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-black/50 text-white border border-white/15"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 accent-[#c5f546]"
          />
          <span>
            I agree to the Spark Terms of Service. My workspace starts on the{" "}
            <strong className="text-white">Free plan ($0/month · 5 completed visits/month)</strong>{" "}
            with zero automatic charges.
          </span>
        </label>

        {error ? (
          <div
            className="rounded-lg px-3.5 py-2.5 text-xs font-medium"
            style={{ background: "rgba(239,90,42,0.16)", color: "#ff8a65" }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || !acceptTerms}
            className="px-5 py-2.5 rounded-lg text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ background: "#c5f546", color: "#0A0B0D" }}
          >
            {submitting ? "Creating Workspace…" : "Create Free Workspace →"}
          </button>

          <Link to="/login" className="text-xs underline text-slate-400 hover:text-white">
            Already have an account? Sign in
          </Link>
        </div>
      </form>

      <aside
        className="lg:col-span-5 rounded-2xl p-6 space-y-4"
        style={{
          background: "#111317",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mono text-slate-400">
          Included CPG Starter Templates
        </p>
        <div className="space-y-3">
          {catalog.starters.map((s) => (
            <div
              key={s.key}
              className="rounded-xl p-3.5 space-y-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-sm font-semibold text-white">{s.name}</p>
              <p className="text-xs text-slate-400">{s.description}</p>
              <p className="text-[11px] mono text-[#c5f546]">
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
    const cleanStore = quickStore.trim();
    if (!cleanStore) {
      setError("Enter the real store or venue name before logging a field recap.");
      return;
    }
    const samplesTrim = quickSamples.trim();
    const consumersTrim = quickConsumers.trim();
    const unitsTrim = quickUnits.trim();
    if (!samplesTrim || !consumersTrim || !unitsTrim) {
      setError(
        "Enter actual Samples, Consumers Sampled, and Observed Units from the shift before submitting.",
      );
      return;
    }
    const samplesNum = Number(samplesTrim);
    const consumersNum = Number(consumersTrim);
    const unitsNum = Number(unitsTrim);
    if (
      !Number.isInteger(samplesNum) ||
      samplesNum < 0 ||
      !Number.isInteger(consumersNum) ||
      consumersNum < 0 ||
      !Number.isInteger(unitsNum) ||
      unitsNum < 0
    ) {
      setError("Samples, Consumers Sampled, and Observed Units must be non-negative whole numbers.");
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
            storeName: cleanStore,
            city: quickCity.trim(),
            stateCode: quickState.trim().toUpperCase(),
            visitDate:
              quickVisitDate.trim() ||
              currentDateInTimezone(st.businessTimezone),
            samplesDistributed: samplesNum,
            consumersSampled: consumersNum,
            repObservedUnits: unitsNum,
            notes: quickNotes.trim(),
          }),
        },
      );
      const body = (await resp.json()) as { ok?: boolean; message?: string };
      if (!resp.ok || !body.ok) {
        setError(body.message || "Could not submit field recap.");
      } else {
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

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4"
        style={{ background: "#111317", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold mono"
              style={{ background: planBadge.bg, color: planBadge.fg }}
            >
              {planBadge.label} · {st.completedVisitsUsed}/{st.includedVisits ?? "∞"} visits used
            </span>
            <span className="text-xs mono text-slate-400">
              Timezone: {st.businessTimezone}
            </span>
          </div>
          <h2 className="display text-2xl font-bold text-white mt-2">
            {st.tenantName} · Self-Service Launch Checklist ({st.stepsCompleted}/{st.totalSteps})
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/workspace")}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white border border-white/15 hover:bg-white/5"
          >
            Open Workspace →
          </button>
          <button
            type="button"
            onClick={() => navigate("/plans-billing")}
            className="px-3.5 py-2 rounded-lg text-xs font-bold"
            style={{ background: "#c5f546", color: "#0A0B0D" }}
          >
            Plans & Visit Meter →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className="rounded-xl px-3.5 py-3 text-xs"
            style={{
              background: step.done ? "rgba(197,245,70,0.10)" : "#111317",
              border: step.done
                ? "1px solid rgba(197,245,70,0.35)"
                : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p className="mono font-bold" style={{ color: step.done ? "#c5f546" : "#94a3b8" }}>
              STEP {i + 1} · {step.done ? "DONE" : "NEXT"}
            </p>
            <p className="font-medium text-white mt-1">{step.label}</p>
          </div>
        ))}
      </div>

      {banner ? (
        <div
          className="rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: "rgba(197,245,70,0.14)", color: "#c5f546" }}
        >
          {banner}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: "rgba(239,90,42,0.16)", color: "#ff8a65" }}
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 2: Starter Program */}
        <form
          onSubmit={handleSaveStarter}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "#111317", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider mono text-[#c5f546]">
              Step 2 · Starter Program & Recap Template
            </p>
            <h3 className="display text-lg font-bold text-white mt-1">
              Choose your field activation format
            </h3>
          </div>

          <div className="space-y-2">
            {st.starters.map((opt) => (
              <label
                key={opt.key}
                className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
                style={{
                  background:
                    selectedKey === opt.key
                      ? "rgba(197,245,70,0.09)"
                      : "rgba(255,255,255,0.02)",
                  border:
                    selectedKey === opt.key
                      ? "1px solid rgba(197,245,70,0.4)"
                      : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <input
                  type="radio"
                  name="starterKey"
                  checked={selectedKey === opt.key}
                  onChange={() => setSelectedKey(opt.key)}
                  className="mt-1 accent-[#c5f546]"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{opt.name}</p>
                  <p className="text-xs text-slate-400">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={customProgramName}
              onChange={(e) => setCustomProgramName(e.target.value)}
              placeholder="Custom program title (optional)"
              className="rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
            />
            <input
              type="text"
              value={starterSkuName}
              onChange={(e) => setStarterSkuName(e.target.value)}
              placeholder="Flagship SKU name (optional)"
              className="rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
            />
          </div>

          <button
            type="submit"
            disabled={savingStarter}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: "#c5f546", color: "#0A0B0D" }}
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
          style={{ background: "#111317", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider mono text-[#c5f546]">
              Step 3 · Optional Team or Agency Invite
            </p>
            <h3 className="display text-lg font-bold text-white mt-1">
              Invite a field contributor or viewer (Free seat)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Field contributors and read-only viewers are always free. Repeating an invite safely reuses the existing token.
            </p>
          </div>

          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="rep@agency-or-team.com"
            className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
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
              className="rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
            />
          </div>

          <button
            type="submit"
            disabled={savingInvite}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white border border-white/20 hover:bg-white/5"
          >
            {savingInvite ? "Sending Invite…" : "Send Contributor Invite"}
          </button>
        </form>
      </div>

      {/* Step 4 & 5: Mobile Recap Link + First Visit Approval & Share Link */}
      <section
        className="rounded-2xl p-6 space-y-5"
        style={{ background: "#111317", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider mono text-[#c5f546]">
              Steps 4 & 5 · Mobile Field Recap & Self-Service Approval
            </p>
            <h3 className="display text-lg font-bold text-white mt-1">
              Complete your first visit & shareable recap without Ignite staffing
            </h3>
          </div>

          {mobileUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-1.5 rounded-lg text-xs mono bg-black/60 text-[#c5f546] border border-white/10">
                {mobileUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(mobileUrl)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-white/15 hover:bg-white/5"
              >
                Copy Mobile Link
              </button>
              <a
                href={`/provider-submit/${encodeURIComponent(st.submissionCode || "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "#c5f546", color: "#0A0B0D" }}
              >
                Open Mobile Form ↗
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Complete Step 2 above to mint your mobile field submission link.
            </p>
          )}
        </div>

        {st.submissionCode ? (
          <form
            onSubmit={handleQuickFieldSubmit}
            className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end pt-2 border-t border-white/10"
          >
            <label className="md:col-span-2 space-y-1">
              <span className="text-[11px] text-slate-400">Store / Venue *</span>
              <input
                type="text"
                required
                value={quickStore}
                onChange={(e) => setQuickStore(e.target.value)}
                placeholder="e.g. Store name & #"
                className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">City / State</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  placeholder="City"
                  className="w-2/3 rounded-lg px-2.5 py-2 text-xs bg-black/50 text-white border border-white/15"
                />
                <input
                  type="text"
                  value={quickState}
                  onChange={(e) => setQuickState(e.target.value)}
                  placeholder="ST"
                  maxLength={2}
                  className="w-1/3 rounded-lg px-2 py-2 text-xs bg-black/50 text-white border border-white/15 uppercase"
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Visit Date ({st.businessTimezone}) *</span>
              <input
                type="date"
                required
                value={quickVisitDate}
                onChange={(e) => setQuickVisitDate(e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Samples *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickSamples}
                onChange={(e) => setQuickSamples(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Consumers *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickConsumers}
                onChange={(e) => setQuickConsumers(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Observed Units *</span>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={quickUnits}
                onChange={(e) => setQuickUnits(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
            <button
              type="submit"
              disabled={submittingField}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
            >
              {submittingField ? "Submitting…" : "Log Field Recap"}
            </button>
            <label className="md:col-span-8 space-y-1">
              <span className="text-[11px] text-slate-400">Shift notes (optional)</span>
              <input
                type="text"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="Optional field notes from the visit"
                className="w-full rounded-lg px-3 py-2 text-xs bg-black/50 text-white border border-white/15"
              />
            </label>
          </form>
        ) : null}

        {st.recentVisits.length > 0 ? (
          <div className="space-y-2 pt-2">
            <p className="text-xs uppercase tracking-wider mono text-slate-400">
              Submitted & Completed Workspace Visits
            </p>
            {st.recentVisits.map((v) => (
              <div
                key={v.uuid}
                className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {v.storeLabel}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      · {v.visitDate} · {v.samplesDistributed ?? 0} samples · {v.repObservedUnits ?? 0} units
                    </span>
                  </p>
                  <p className="text-xs mono text-slate-400">
                    Status: {v.status} · Submissions linked: {v.submissionCount}
                  </p>
                </div>

                {v.status !== "completed" ? (
                  <button
                    type="button"
                    disabled={savingApprove}
                    onClick={() => handleApproveVisit(v.uuid)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: "#c5f546", color: "#0A0B0D" }}
                  >
                    Approve Recap & Mint Share Link →
                  </button>
                ) : (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold mono"
                    style={{ background: "rgba(197,245,70,0.16)", color: "#c5f546" }}
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
            style={{ background: "rgba(197,245,70,0.08)", border: "1px solid rgba(197,245,70,0.3)" }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mono text-[#c5f546]">
                Shareable Recap Ready
              </p>
              <p className="text-xs text-slate-300 mt-0.5">{sharedUrl}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(sharedUrl)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-white/20"
              >
                Copy Share Link
              </button>
              <a
                href={`/workspace-share/${encodeURIComponent(st.firstSharedToken || "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "#c5f546", color: "#0A0B0D" }}
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
  const [fetchKey, setFetchKey] = useState(0);
  const bump = () => setFetchKey((k) => k + 1);

  return (
    <div
      className="min-h-[100dvh] py-8 px-4 md:px-8"
      style={{ background: "#0A0B0D", color: "#f8fafc" }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: "#c5f546" }}
            />
            <span className="display font-bold tracking-tight text-lg text-white">
              SPARK BY IGNITE
            </span>
            <span className="text-xs mono text-slate-400">
              Standalone Brand Workspace Onboarding
            </span>
          </div>
          {isAuthenticated ? (
            <Link
              to="/plans-billing"
              className="text-xs font-semibold mono text-[#c5f546] hover:underline"
            >
              Plans, Usage Meter & Billing →
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white"
            >
              Sign in to existing account →
            </Link>
          )}
        </header>

        <Suspense
          fallback={
            <div className="py-12 text-sm text-slate-400">
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
