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

export interface WorkspaceContextItem {
  membershipUuid?: string | null;
  tenantUuid: string;
  tenantName: string;
  tenantSlug: string;
  workspaceRole: string;
  providerUuid?: string | null;
  providerName?: string | null;
  displayLabel: string;
  isCurrent: boolean;
}

export interface UnifiedWorkspaceOption {
  /** Stable key: `membership:<uuid>` when membership-scoped, else `tenant:<uuid>`. */
  key: string;
  tenantUuid: string;
  tenantId: string;
  name: string;
  tenantSlug: string | null;
  requestUrlName: string | null;
  checkinCode: string | null;
  logo: string | null;
  membershipUuid: string | null;
  workspaceRole: string | null;
  providerUuid: string | null;
  providerName: string | null;
  displayLabel: string;
  isCurrent: boolean;
  /** True when backed by `myWorkspaceContexts` so switches sync via `switchWorkspaceContext`. */
  fromWorkspaceContext: boolean;
}

/**
 * Merge `myWorkspaceContexts` (managed brands + agency memberships) with
 * `TenantQuery` rows (logos, Relay IDs, check-in codes) into one deduplicated,
 * `[ARCHIVED]`-filtered list for the unified sidebar workspace switcher.
 */
export function buildUnifiedWorkspaceOptions(params: {
  contexts: readonly WorkspaceContextItem[];
  tenants: readonly SwitchableTenant[];
  active?: {
    tenantUuid?: string | null;
    membershipUuid?: string | null;
  };
}): UnifiedWorkspaceOption[] {
  const { contexts, tenants, active = {} } = params;
  const tenantByUuid = new Map<string, SwitchableTenant>();
  for (const t of tenants) {
    if (t.uuid) tenantByUuid.set(t.uuid, t);
  }

  const merged: UnifiedWorkspaceOption[] = [];
  const seenKeys = new Set<string>();
  const coveredTenantUuids = new Set<string>();

  for (const ctx of contexts) {
    if (!ctx.tenantUuid) continue;
    const key = workspaceContextOptionKey(ctx);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    coveredTenantUuids.add(ctx.tenantUuid);

    const meta = tenantByUuid.get(ctx.tenantUuid);
    const name =
      (ctx.tenantName || meta?.name || "").trim() ||
      ctx.tenantSlug ||
      meta?.tenantSlug ||
      meta?.requestUrlName ||
      "Workspace";

    merged.push({
      key,
      tenantUuid: ctx.tenantUuid,
      tenantId: meta?.id ?? "",
      name,
      tenantSlug: ctx.tenantSlug || meta?.tenantSlug || null,
      requestUrlName: meta?.requestUrlName ?? null,
      checkinCode: meta?.checkinCode ?? null,
      logo: meta?.logo ?? null,
      membershipUuid: ctx.membershipUuid ?? null,
      workspaceRole: ctx.workspaceRole || null,
      providerUuid: ctx.providerUuid ?? null,
      providerName: ctx.providerName ?? null,
      displayLabel: (ctx.displayLabel || "").trim() || name,
      isCurrent: Boolean(ctx.isCurrent),
      fromWorkspaceContext: true,
    });
  }

  for (const t of tenants) {
    if (!t.uuid || coveredTenantUuids.has(t.uuid)) continue;
    const key = workspaceContextOptionKey({
      tenantUuid: t.uuid,
      membershipUuid: null,
    });
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const name =
      (t.name ?? "").trim() || t.tenantSlug || t.requestUrlName || "Workspace";

    merged.push({
      key,
      tenantUuid: t.uuid,
      tenantId: t.id,
      name,
      tenantSlug: t.tenantSlug ?? null,
      requestUrlName: t.requestUrlName ?? null,
      checkinCode: t.checkinCode ?? null,
      logo: t.logo ?? null,
      membershipUuid: null,
      workspaceRole: null,
      providerUuid: null,
      providerName: null,
      displayLabel: name,
      isCurrent: false,
      fromWorkspaceContext: false,
    });
  }

  return filterVisibleWorkspaceContexts(
    merged.map((opt) => ({
      opt,
      tenantUuid: opt.tenantUuid,
      tenantName: opt.name,
      displayLabel: opt.displayLabel,
      membershipUuid: opt.membershipUuid,
    })),
    active,
  ).map((row) => row.opt);
}

export function workspaceOptionMatchesQuery(
  opt: Pick<
    UnifiedWorkspaceOption,
    | "name"
    | "tenantSlug"
    | "requestUrlName"
    | "providerName"
    | "displayLabel"
    | "workspaceRole"
  >,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const roleText = opt.workspaceRole ? workspaceRoleLabel(opt.workspaceRole) : "";
  const haystack = [
    opt.name,
    opt.tenantSlug,
    opt.requestUrlName,
    opt.providerName,
    opt.displayLabel,
    roleText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function formatWorkspaceOptionSubtitle(
  opt: Pick<
    UnifiedWorkspaceOption,
    "providerName" | "workspaceRole" | "tenantSlug" | "requestUrlName"
  >,
  options?: { hasDuplicateTenant?: boolean },
): string | null {
  const provider = (opt.providerName ?? "").trim();
  const roleLabel = opt.workspaceRole
    ? workspaceRoleLabel(opt.workspaceRole)
    : "";
  if (provider) {
    return roleLabel ? `${provider} · ${roleLabel}` : provider;
  }
  if (options?.hasDuplicateTenant && roleLabel) {
    return roleLabel;
  }
  return opt.tenantSlug || opt.requestUrlName || null;
}


