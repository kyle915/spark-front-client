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
        bg: "rgba(197,245,70,0.16)",
        fg: "#c5f546",
      };
    case "invoiced":
      return {
        label: "Invoiced",
        bg: "rgba(56,189,248,0.16)",
        fg: "#7dd3fc",
      };
    case "estimated":
      return {
        label: "Estimated",
        bg: "rgba(250,204,21,0.15)",
        fg: "#fde047",
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
        bg: "rgba(197,245,70,0.15)",
        fg: "#c5f546",
      };
    case "estimated":
      return {
        label: "Estimated",
        bg: "rgba(250,204,21,0.14)",
        fg: "#fde047",
      };
    case "missing":
      return {
        label: "Missing proof / rate",
        bg: "rgba(239,90,42,0.18)",
        fg: "#ef5a2a",
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
        bg: "rgba(148,163,184,0.16)",
        fg: "#cbd5e1",
      };
    case "core":
      return {
        label: "Core",
        priceSummary: "$299/mo · 50 visits",
        bg: "rgba(56,189,248,0.16)",
        fg: "#7dd3fc",
      };
    case "pro":
      return {
        label: "Pro",
        priceSummary: "$750/mo · 100 visits",
        bg: "rgba(197,245,70,0.18)",
        fg: "#c5f546",
      };
    case "pilot_pro":
      return {
        label: "60-Day Pro Pilot",
        priceSummary: "$1,500 pilot · 100 visits/mo",
        bg: "rgba(197,245,70,0.22)",
        fg: "#c5f546",
      };
    case "scale":
      return {
        label: "Scale",
        priceSummary: "From $1,500/mo · 250 visits",
        bg: "rgba(250,204,21,0.16)",
        fg: "#fde047",
      };
    case "managed_sow":
      return {
        label: "Managed SOW",
        priceSummary: "Contracted Ignite SOW",
        bg: "rgba(197,245,70,0.14)",
        fg: "#c5f546",
      };
    default: {
      if (typeof planCode === "string" && planCode) {
        return {
          label: planCode.toUpperCase(),
          priceSummary: "Custom plan",
          bg: "rgba(148,163,184,0.16)",
          fg: "#cbd5e1",
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
        bg: "rgba(148,163,184,0.15)",
        fg: "#cbd5e1",
      };
    case "pilot_active":
      return {
        label: "60-Day Pilot Active",
        bg: "rgba(197,245,70,0.18)",
        fg: "#c5f546",
      };
    case "pilot_expired":
      return {
        label: "Pilot Ended · Free Fallback",
        bg: "rgba(250,204,21,0.18)",
        fg: "#fde047",
      };
    case "checkout_pending":
      return {
        label: "Checkout Open",
        bg: "rgba(56,189,248,0.16)",
        fg: "#7dd3fc",
      };
    case "active":
      return {
        label: "Active Recurring",
        bg: "rgba(197,245,70,0.18)",
        fg: "#c5f546",
      };
    case "past_due":
      return {
        label: "Payment Past Due",
        bg: "rgba(239,90,42,0.22)",
        fg: "#ef5a2a",
      };
    case "cancel_at_period_end":
      return {
        label: "Cancels at Period End (Paid-Through)",
        bg: "rgba(250,204,21,0.16)",
        fg: "#fde047",
      };
    case "canceled":
      return {
        label: "Cancelled · Free Tier",
        bg: "rgba(148,163,184,0.16)",
        fg: "#cbd5e1",
      };
    case "managed_sow":
      return {
        label: "Ignite Managed SOW",
        bg: "rgba(197,245,70,0.14)",
        fg: "#c5f546",
      };
    default: {
      if (typeof status === "string" && status) {
        return {
          label: status.replace(/_/g, " "),
          bg: "rgba(148,163,184,0.16)",
          fg: "#cbd5e1",
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
      barColor: "#c5f546",
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
      barColor: params.overageAgreementApproved ? "#fde047" : "#ef5a2a",
      isAtCap: true,
    };
  }
  const rem = cap - used;
  return {
    percent: pct,
    summaryLabel: `${used} / ${cap} completed visits`,
    remainingLabel: `${rem} included visit${rem === 1 ? "" : "s"} remaining this month`,
    barColor: pct >= 80 ? "#fde047" : "#c5f546",
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


