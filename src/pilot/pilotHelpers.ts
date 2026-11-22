/**
 * Pure formatting, badge, state-reset, and download helpers for Standalone Spark
 * Milestone 1 workspaces, costs, finance exceptions, retailer POS, and store actions.
 */
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import { applyTenantSwitch } from "@/hooks/useAdoptRecordTenant";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import { useAuthStore } from "@/store/authStore";

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

async function defaultLoadTenants(
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
  loadTenants: (
    userUuid?: string | null,
  ) => Promise<SwitchableTenant[]> = defaultLoadTenants,
): Promise<void> {
  const store = useAuthStore.getState();
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
      applyTenantSwitch({
        ...match,
        tenantSlug: match.tenantSlug ?? (chosen.tenantSlug || null),
      });
    }
  } catch {
    // External provider memberships intentionally have no consolidated TenantQuery
    // row; the cleared baseline set above keeps tenant state consistent.
  }
}

