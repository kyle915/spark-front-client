/**
 * Pure formatting, badge, state-reset, and download helpers for Standalone Spark
 * Milestone 1 workspaces, costs, finance exceptions, retailer POS, and store actions.
 *
 * Kept free of Relay `graphql` module imports so Vitest runs cleanly before
 * `relay-compiler` generates `__generated__` artifacts in CI.
 */
import type { SwitchableTenant } from "@/lib/tenantDeepLink";

export type WorkspaceRoleKind =
  | "brand_admin"
  | "brand_reviewer"
  | "finance_reviewer"
  | "brand_viewer"
  | "provider_manager"
  | "provider_rep";

export type CostSettlementKind = "estimated" | "invoiced" | "paid";
export type CostEvidenceKind = "supported" | "estimated" | "missing";

export type FinanceExceptionStatusKind =
  | "open"
  | "needs_clarification"
  | "resolved"
  | "exception_granted"
  | "auto_cleared";

export type StoreActionTypeKind = "rebook" | "hold" | "restock";

function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated variant: ${String(value)}`);
}

export function workspaceRoleLabel(role: string): string {
  const known = role as WorkspaceRoleKind;
  switch (known) {
    case "brand_admin":
      return "Brand Admin";
    case "brand_reviewer":
      return "Brand Ops / Reviewer";
    case "finance_reviewer":
      return "Finance Reviewer";
    case "brand_viewer":
      return "Read-Only Viewer";
    case "provider_manager":
      return "Agency Manager";
    case "provider_rep":
      return "Field Rep";
    default: {
      // Runtime fallback for unknown server strings while keeping exhaustive check
      if (typeof role === "string" && role) {
        if (role === "field_contributor") return "Field Contributor";
        return role.replace(/_/g, " ");
      }
      return assertNever(known);
    }
  }
}

export function settlementBadgeMeta(status: CostSettlementKind): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        bg: "var(--spark-ok-bg)",
        fg: "var(--spark-ok-ink)",
      };
    case "invoiced":
      return {
        label: "Invoiced",
        bg: "var(--spark-info-bg)",
        fg: "var(--spark-info-ink)",
      };
    case "estimated":
      return {
        label: "Estimated",
        bg: "var(--spark-warn-badge-bg)",
        fg: "var(--spark-warn-badge-ink)",
      };
    default:
      return assertNever(status);
  }
}

export function evidenceBadgeMeta(status: CostEvidenceKind): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (status) {
    case "supported":
      return {
        label: "Supported",
        bg: "var(--spark-ok-bg)",
        fg: "var(--spark-ok-ink)",
      };
    case "estimated":
      return {
        label: "Estimated",
        bg: "var(--spark-warn-badge-bg)",
        fg: "var(--spark-warn-badge-ink)",
      };
    case "missing":
      return {
        label: "Missing proof / rate",
        bg: "rgba(239,90,42,0.14)",
        fg: "var(--spark-flag-ink, #ef5a2a)",
      };
    default:
      return assertNever(status);
  }
}

export function exceptionStatusLabel(status: FinanceExceptionStatusKind): string {
  switch (status) {
    case "open":
      return "Open";
    case "needs_clarification":
      return "Needs clarification";
    case "resolved":
      return "Resolved";
    case "exception_granted":
      return "Exception granted";
    case "auto_cleared":
      return "Auto-cleared";
    default:
      return assertNever(status);
  }
}

export function storeActionLabel(actionType: StoreActionTypeKind): string {
  switch (actionType) {
    case "rebook":
      return "Rebook visit";
    case "hold":
      return "Hold store";
    case "restock":
      return "Restock / store check";
    default:
      return assertNever(actionType);
  }
}

/**
 * Format money while strictly distinguishing `null` ("Unknown — missing rate")
 * from confirmed `"0.00"` ("$0.00").
 */
export function formatHonestMoney(
  amount: string | null | undefined,
  opts?: { isConfirmedZero?: boolean; incomplete?: boolean },
): string {
  if (amount == null || amount === "") {
    return "Unknown";
  }
  const num = Number(amount);
  if (Number.isNaN(num)) return "Unknown";
  if (num === 0 && opts?.isConfirmedZero === false) {
    return "Unknown";
  }
  const formatted = `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return opts?.incomplete ? `${formatted} (incomplete)` : formatted;
}

export function formatCoveragePercent(ratio: string | null | undefined): string {
  if (ratio == null || ratio === "") return "0%";
  const num = Number(ratio);
  if (Number.isNaN(num)) return "0%";
  return `${Math.round(num * 100)}%`;
}

export function triggerExportDownload(params: {
  filename: string;
  mimeType: string;
  isBase64: boolean;
  content: string;
}): void {
  let blob: Blob;
  if (params.isBase64) {
    const binary = window.atob(params.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: params.mimeType });
  } else {
    blob = new Blob([params.content], { type: params.mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface MobileVisitSeed {
  uuid: string;
  store_label: string;
  address: string;
  city: string;
  state_code: string;
  visit_date: string;
}

export interface MobileShiftFormState {
  storeBanner: string;
  storeNumber: string;
  address: string;
  city: string;
  stateCode: string;
  visitDate: string;
  shiftKey: string;
  repName: string;
  samplesDistributed: string;
  consumersSampled: string;
  repObservedUnits: string;
  notes: string;
  productSpendAmount: string;
  supplySpendAmount: string;
  isReceiptItemized: boolean;
}

export function buildInitialShiftFormState(
  visit: MobileVisitSeed | null | undefined,
  todayIso: string = new Date().toISOString().slice(0, 10),
): MobileShiftFormState {
  return {
    storeBanner: visit?.store_label ?? "",
    storeNumber: "",
    address: visit?.address ?? "",
    city: visit?.city ?? "",
    stateCode: visit?.state_code ?? "",
    visitDate: visit?.visit_date ?? todayIso,
    shiftKey: "default",
    repName: "",
    samplesDistributed: "",
    consumersSampled: "",
    repObservedUnits: "",
    notes: "",
    productSpendAmount: "",
    supplySpendAmount: "",
    isReceiptItemized: true,
  };
}

export interface WorkspaceSwitchStoreAdapter {
  user?: { uuid?: string | null } | null;
  setWorkspaceMembership: (
    membershipUuid: string | null,
    workspaceRole?: string | null,
  ) => void;
  setTenant: (
    tenantUuid: string,
    tenantId: string,
    logo?: string | null,
    requestUrlName?: string | null,
    tenantSlug?: string | null,
    checkinCode?: string | null,
  ) => void;
}

/**
 * Persist the selected workspace membership AND refresh/clear all tenant fields
 * (`tenantId`, `tenantSlug`, `logo`, `requestUrlName`, `checkinCode`) so stale
 * metadata from the previously selected brand never leaks across reloads.
 */
export async function applyWorkspaceContextSelection(
  chosen: {
    membershipUuid?: string | null;
    tenantUuid: string;
    tenantSlug?: string | null;
    workspaceRole: string;
  },
  deps: {
    store: WorkspaceSwitchStoreAdapter;
    loadTenants: (userUuid?: string | null) => Promise<SwitchableTenant[]>;
    rememberRecent?: (tenantUuid: string) => void;
  },
): Promise<void> {
  const { store, loadTenants, rememberRecent } = deps;
  store.setWorkspaceMembership(
    chosen.membershipUuid ?? null,
    chosen.workspaceRole,
  );
  // Immediately clear any previous tenant's Relay ID, logo, request URL, and
  // check-in code while stamping the new tenantUuid + tenantSlug.
  store.setTenant(
    chosen.tenantUuid,
    "",
    null,
    null,
    chosen.tenantSlug || null,
    null,
  );

  try {
    const tenants = await loadTenants(store.user?.uuid);
    const match = tenants.find((t) => t.uuid === chosen.tenantUuid);
    if (match) {
      rememberRecent?.(match.uuid);
      store.setTenant(
        match.uuid,
        match.id,
        match.logo,
        match.requestUrlName,
        match.tenantSlug ?? (chosen.tenantSlug || null),
        match.checkinCode,
      );
    }
  } catch {
    // External provider memberships intentionally have no consolidated TenantQuery
    // row; the cleared baseline set above keeps tenant state consistent.
  }
}

export function isArchivedWorkspaceLabel(
  value: string | null | undefined,
): boolean {
  return Boolean(value && value.trim().toUpperCase().startsWith("[ARCHIVED]"));
}

export function workspaceContextOptionKey(ctx: {
  membershipUuid?: string | null;
  tenantUuid: string;
}): string {
  return ctx.membershipUuid
    ? `membership:${ctx.membershipUuid}`
    : `tenant:${ctx.tenantUuid}`;
}

export function filterVisibleWorkspaceContexts<
  T extends {
    tenantUuid: string;
    tenantName?: string | null;
    displayLabel?: string | null;
    membershipUuid?: string | null;
  },
>(
  contexts: readonly T[],
  active: {
    tenantUuid?: string | null;
    membershipUuid?: string | null;
  } = {},
): T[] {
  return contexts.filter((ctx) => {
    const isCurrentlySelected =
      (Boolean(active.tenantUuid) && ctx.tenantUuid === active.tenantUuid) ||
      (Boolean(active.membershipUuid) &&
        ctx.membershipUuid === active.membershipUuid);
    if (isCurrentlySelected) return true;
    return (
      !isArchivedWorkspaceLabel(ctx.tenantName) &&
      !isArchivedWorkspaceLabel(ctx.displayLabel)
    );
  });
}

export function resolveActiveWorkspaceContextKey(
  contexts: readonly {
    tenantUuid: string;
    membershipUuid?: string | null;
    isCurrent?: boolean;
  }[],
  active: {
    tenantUuid?: string | null;
    membershipUuid?: string | null;
  },
): string {
  if (contexts.length === 0) return "";
  const { tenantUuid, membershipUuid } = active;

  if (tenantUuid && membershipUuid) {
    const exactBoth = contexts.find(
      (c) => c.tenantUuid === tenantUuid && c.membershipUuid === membershipUuid,
    );
    if (exactBoth) return workspaceContextOptionKey(exactBoth);
  }

  if (tenantUuid) {
    const currentForTenant = contexts.find(
      (c) => c.tenantUuid === tenantUuid && c.isCurrent,
    );
    if (currentForTenant) return workspaceContextOptionKey(currentForTenant);
    const firstForTenant = contexts.find((c) => c.tenantUuid === tenantUuid);
    if (firstForTenant) return workspaceContextOptionKey(firstForTenant);
  }

  if (membershipUuid) {
    const byMembership = contexts.find(
      (c) => c.membershipUuid === membershipUuid,
    );
    if (byMembership) return workspaceContextOptionKey(byMembership);
  }

  const serverCurrent = contexts.find((c) => c.isCurrent);
  if (serverCurrent) return workspaceContextOptionKey(serverCurrent);

  return workspaceContextOptionKey(contexts[0]);
}

export function formatSingleWorkspaceBadgeLabel(ctx: {
  tenantName?: string | null;
  providerName?: string | null;
  displayLabel?: string | null;
}): string {
  const brand = (ctx.tenantName ?? "").trim();
  const provider = (ctx.providerName ?? "").trim();
  if (brand && provider) return `${brand} · ${provider}`;
  if (brand) return brand;
  if (provider) return provider;
  return (ctx.displayLabel ?? "").trim();
}

export const PILOT_CONTRAST_PALETTE = {
  dark: {
    pageBg: "#0A0B0D",
    cardBg: "#141416",
    text: "#f2f3ee",
    ctaBg: "#f2f3ee",
    ctaFg: "#0A0B0D",
    okBg: "#0d2e24",
    okFg: "#6ee7b7",
    infoBg: "#0f2942",
    infoFg: "#93c5fd",
    warnBg: "#332407",
    warnFg: "#fcd34d",
    dangerBg: "#361512",
    dangerFg: "#fca5a5",
    neutralBg: "#1e2430",
    neutralFg: "#e2e8f0",
    meterTrack: "#181b20",
    meterOk: "#34d399",
    meterWarn: "#fbbf24",
    meterDanger: "#ff7849",
  },
  light: {
    pageBg: "#f6f6f2",
    cardBg: "#ffffff",
    text: "#14160f",
    ctaBg: "#14160f",
    ctaFg: "#ffffff",
    okBg: "#ecfdf5",
    okFg: "#065f46",
    infoBg: "#eff6ff",
    infoFg: "#1e40af",
    warnBg: "#fffbeb",
    warnFg: "#92400e",
    dangerBg: "#fef2f2",
    dangerFg: "#991b1b",
    neutralBg: "#f1f5f9",
    neutralFg: "#334155",
    meterTrack: "#e2e8f0",
    meterOk: "#065f46",
    meterWarn: "#92400e",
    meterDanger: "#9a3412",
  },
} as const;

export type PlanCodeKind =
  | "free"
  | "core"
  | "pro"
  | "scale"
  | "pilot_pro"
  | "managed_sow";

export type SubscriptionStatusKind =
  | "free_active"
  | "pilot_active"
  | "pilot_expired"
  | "checkout_pending"
  | "active"
  | "past_due"
  | "cancel_at_period_end"
  | "canceled"
  | "managed_sow";

export function planBadgeMeta(planCode: string): {
  label: string;
  priceSummary: string;
  bg: string;
  fg: string;
} {
  const known = planCode as PlanCodeKind;
  switch (known) {
    case "free":
      return {
        label: "Free",
        priceSummary: "$0/mo · 5 visits",
        bg: "var(--pilot-neutral-bg)",
        fg: "var(--pilot-neutral-fg)",
      };
    case "core":
      return {
        label: "Core",
        priceSummary: "$299/mo · 50 visits",
        bg: "var(--pilot-info-bg)",
        fg: "var(--pilot-info-fg)",
      };
    case "pro":
      return {
        label: "Pro",
        priceSummary: "$750/mo · 100 visits",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    case "pilot_pro":
      return {
        label: "60-Day Pro Pilot",
        priceSummary: "$1,500 pilot · 100 visits/mo",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    case "scale":
      return {
        label: "Scale",
        priceSummary: "From $1,500/mo · 250 visits",
        bg: "var(--pilot-warn-bg)",
        fg: "var(--pilot-warn-fg)",
      };
    case "managed_sow":
      return {
        label: "Managed SOW",
        priceSummary: "Contracted Ignite SOW",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    default: {
      if (typeof planCode === "string" && planCode) {
        return {
          label: planCode.toUpperCase(),
          priceSummary: "Custom plan",
          bg: "var(--pilot-neutral-bg)",
          fg: "var(--pilot-neutral-fg)",
        };
      }
      return assertNever(known);
    }
  }
}

export function subscriptionStatusBadge(status: string): {
  label: string;
  bg: string;
  fg: string;
} {
  const known = status as SubscriptionStatusKind;
  switch (known) {
    case "free_active":
      return {
        label: "Free Active",
        bg: "var(--pilot-neutral-bg)",
        fg: "var(--pilot-neutral-fg)",
      };
    case "pilot_active":
      return {
        label: "60-Day Pilot Active",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    case "pilot_expired":
      return {
        label: "Pilot Ended · Free Fallback",
        bg: "var(--pilot-warn-bg)",
        fg: "var(--pilot-warn-fg)",
      };
    case "checkout_pending":
      return {
        label: "Checkout Open",
        bg: "var(--pilot-info-bg)",
        fg: "var(--pilot-info-fg)",
      };
    case "active":
      return {
        label: "Active Recurring",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    case "past_due":
      return {
        label: "Payment Past Due",
        bg: "var(--pilot-danger-bg)",
        fg: "var(--pilot-danger-fg)",
      };
    case "cancel_at_period_end":
      return {
        label: "Cancels at Period End (Paid-Through)",
        bg: "var(--pilot-warn-bg)",
        fg: "var(--pilot-warn-fg)",
      };
    case "canceled":
      return {
        label: "Cancelled · Free Tier",
        bg: "var(--pilot-neutral-bg)",
        fg: "var(--pilot-neutral-fg)",
      };
    case "managed_sow":
      return {
        label: "Ignite Managed SOW",
        bg: "var(--pilot-ok-bg)",
        fg: "var(--pilot-ok-fg)",
      };
    default: {
      if (typeof status === "string" && status) {
        return {
          label: status.replace(/_/g, " "),
          bg: "var(--pilot-neutral-bg)",
          fg: "var(--pilot-neutral-fg)",
        };
      }
      return assertNever(known);
    }
  }
}

export function computeVisitMeterProgress(params: {
  completedVisitsUsed: number;
  effectiveVisitCap: number | null | undefined;
  overageAgreementApproved?: boolean;
}): {
  percent: number;
  summaryLabel: string;
  remainingLabel: string;
  barColor: string;
  isAtCap: boolean;
} {
  const used = Math.max(0, params.completedVisitsUsed || 0);
  const cap = params.effectiveVisitCap;
  if (cap == null || cap <= 0) {
    return {
      percent: 18,
      summaryLabel: `${used} completed visits (Managed SOW — uncapped)`,
      remainingLabel: "Included in contracted SOW",
      barColor: "var(--pilot-meter-ok)",
      isAtCap: false,
    };
  }
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const isAtCap = used >= cap;
  const over = Math.max(0, used - cap);
  if (isAtCap) {
    return {
      percent: 100,
      summaryLabel: `${used} / ${cap} completed visits`,
      remainingLabel: params.overageAgreementApproved
        ? `${over} over allowance (approved volume band active)`
        : over > 0
          ? `${over} completed from already-underway shifts (no automatic charge) · Upgrade to book new visits`
          : "Monthly allowance reached · In-progress fieldwork still submits cleanly",
      barColor: params.overageAgreementApproved
        ? "var(--pilot-meter-warn)"
        : "var(--pilot-meter-danger)",
      isAtCap: true,
    };
  }
  const rem = cap - used;
  return {
    percent: pct,
    summaryLabel: `${used} / ${cap} completed visits`,
    remainingLabel: `${rem} included visit${rem === 1 ? "" : "s"} remaining this month`,
    barColor: pct >= 80 ? "var(--pilot-meter-warn)" : "var(--pilot-meter-ok)",
    isAtCap: false,
  };
}

export function formatPilotCountdown(
  pilotEndsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!pilotEndsAtIso) return "60-day Pro pilot";
  const endMs = Date.parse(pilotEndsAtIso);
  if (Number.isNaN(endMs)) return "60-day Pro pilot";
  const diffDays = Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return `Pilot window ended (${pilotEndsAtIso.slice(0, 10)})`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"} left in 60-day Pro pilot (ends ${pilotEndsAtIso.slice(0, 10)})`;
}

/**
 * Compute `YYYY-MM-DD` in the workspace's business timezone rather than UTC so
 * afternoon/evening US field submissions never roll over into tomorrow's date.
 */
export function currentDateInTimezone(
  tzName: string | null | undefined,
  now: Date = new Date(),
): string {
  const candidates = [(tzName || "").trim(), "America/Chicago"].filter(Boolean);
  for (const candidateTz of candidates) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: candidateTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {
      /* invalid IANA timezone — fall back to America/Chicago */
    }
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface OnboardingSignupFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  brandName: string;
  businessTimezone: string;
  acceptTerms: boolean;
}

export function createInitialOnboardingSignupState(): OnboardingSignupFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    brandName: "",
    businessTimezone: "America/Chicago",
    acceptTerms: false,
  };
}

export interface OnboardingQuickRecapState {
  storeName: string;
  city: string;
  stateCode: string;
  visitDate: string;
  samplesDistributed: string;
  consumersSampled: string;
  repObservedUnits: string;
}

export function createInitialQuickRecapState(
  businessTimezone?: string | null,
  now: Date = new Date(),
): OnboardingQuickRecapState {
  return {
    storeName: "",
    city: "",
    stateCode: "",
    visitDate: currentDateInTimezone(businessTimezone, now),
    samplesDistributed: "",
    consumersSampled: "",
    repObservedUnits: "",
  };
}

function parseRequiredNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function validateOnboardingQuickRecap(
  form: OnboardingQuickRecapState,
  businessTimezone?: string | null,
  now: Date = new Date(),
):
  | {
      ok: true;
      payload: {
        storeName: string;
        city: string;
        stateCode: string;
        visitDate: string;
        samplesDistributed: number;
        consumersSampled: number;
        repObservedUnits: number;
      };
    }
  | { ok: false; error: string } {
  const storeName = form.storeName.trim();
  if (!storeName) {
    return {
      ok: false,
      error: "Enter the real store or venue name before logging a field recap.",
    };
  }
  const samples = parseRequiredNonNegativeInt(form.samplesDistributed);
  const consumers = parseRequiredNonNegativeInt(form.consumersSampled);
  const units = parseRequiredNonNegativeInt(form.repObservedUnits);
  if (samples === null || consumers === null || units === null) {
    return {
      ok: false,
      error:
        "Enter actual Samples, Consumers Sampled, and Observed Units (0 or more) before submitting.",
    };
  }
  const rawDate = form.visitDate.trim();
  const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : currentDateInTimezone(businessTimezone, now);

  return {
    ok: true,
    payload: {
      storeName,
      city: form.city.trim(),
      stateCode: form.stateCode.trim().toUpperCase(),
      visitDate,
      samplesDistributed: samples,
      consumersSampled: consumers,
      repObservedUnits: units,
    },
  };
}


