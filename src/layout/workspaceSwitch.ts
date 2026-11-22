import { resetRelayStore } from "@/api/relay/environment";
import { rememberTenantRecent } from "@/layout/tenantPickerPrefs";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import { useAuthStore } from "@/store/authStore";

/**
 * Search parameters that describe view state (tab, status chip, date window)
 * rather than a single tenant's record or search query. Kept across workspace
 * switches on collection routes so switching brands on `/recaps/list?status=needs_review`
 * stays on Needs Review for the newly selected brand.
 */
const PRESERVED_VIEW_PARAMS = new Set([
  "status",
  "range",
  "activation",
  "when",
  "view",
  "coverage",
  "tab",
  "horizon",
]);

function filterViewSearch(rawSearch: string | undefined): string {
  if (!rawSearch) return "";
  const incoming = new URLSearchParams(
    rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch,
  );
  const kept = new URLSearchParams();
  for (const [key, val] of incoming.entries()) {
    if (PRESERVED_VIEW_PARAMS.has(key) && val) {
      kept.set(key, val);
    }
  }
  const serialized = kept.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Determine where the router should land when the user switches workspaces.
 *
 * - Collection / tool routes (`/recaps/list`, `/requests/list`, `/account-map`,
 *   `/schedule`, `/walkups`, `/reports`, `/insights`, `/billing`, `/client-dashboard`,
 *   etc.) stay on the current route.
 * - Record-specific routes (`:uuid`, `:storeKey`, `:requestId`, `:tenantId`)
 *   fall back to their natural parent collection route so the new workspace
 *   neither 404s nor auto-adopts back to the previous tenant.
 */
export function resolveWorkspaceSwitchPath(
  pathname: string,
  options: {
    search?: string;
    hash?: string;
    isClient?: boolean;
  } = {},
): string {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const isClient = Boolean(options.isClient);

  if (/^\/recap\/view(?:-legacy|-custom)?\/[^/]+$/i.test(cleanPath)) {
    return "/recaps/list";
  }
  if (/^\/recap-templates\/[^/]+\/edit$/i.test(cleanPath)) {
    return isClient ? "/client-dashboard" : "/recaps/templates";
  }
  if (
    /^\/request\/(?:view|view-legacy|edit|edit-legacy)\/[^/]+$/i.test(
      cleanPath,
    ) ||
    /^\/report-view\/[^/]+$/i.test(cleanPath) ||
    /^\/event\/(?:view|view-legacy|edit|create)\/[^/]+$/i.test(cleanPath)
  ) {
    return "/requests/list";
  }
  if (/^\/store\/[^/]+$/i.test(cleanPath)) {
    return "/account-map";
  }
  if (/^\/reports\/client-recap\/[^/]+$/i.test(cleanPath)) {
    return "/reports";
  }
  if (/^\/job\/view\/[^/]+$/i.test(cleanPath)) {
    return isClient ? "/client-dashboard" : "/jobs";
  }
  if (/^\/plans\/[^/]+$/i.test(cleanPath)) {
    return "/plans";
  }
  if (/^\/clients\/(?!new$)[^/]+$/i.test(cleanPath)) {
    return isClient ? "/client-dashboard" : "/clients";
  }
  if (/^\/academy\/(?!manage$)[^/]+$/i.test(cleanPath)) {
    return "/academy";
  }
  const catalogMatch = cleanPath.match(/^\/catalogs\/([^/]+)\/edit\/[^/]+$/i);
  if (catalogMatch) {
    return `/catalogs/${catalogMatch[1]}/list`;
  }
  if (/^\/ba(?:\/[^/]+)?$/i.test(cleanPath)) {
    return isClient ? "/client-dashboard" : "/talent";
  }

  if (isClient && (cleanPath === "/" || cleanPath === "/dashboard")) {
    return `/client-dashboard${options.hash ?? ""}`;
  }

  const keptSearch = filterViewSearch(options.search);
  const keptHash = options.hash ?? "";
  return `${cleanPath}${keptSearch}${keptHash}`;
}

export interface WorkspaceSwitchSnapshot {
  tenantUuid: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  membershipUuid: string | null;
  workspaceRole: string | null;
  logo: string | null;
  requestUrlName: string | null;
  checkinCode: string | null;
  fullPath: string;
}

export function captureWorkspaceSnapshot(location: {
  pathname: string;
  search?: string;
  hash?: string;
}): WorkspaceSwitchSnapshot {
  const state = useAuthStore.getState();
  return {
    tenantUuid: state.tenantUuid,
    tenantId: state.tenantId,
    tenantSlug: state.tenantSlug,
    membershipUuid: state.membershipUuid,
    workspaceRole: state.workspaceRole,
    logo: state.tenantMeta?.logo ?? null,
    requestUrlName: state.tenantMeta?.requestUrlName ?? null,
    checkinCode: state.tenantMeta?.checkinCode ?? null,
    fullPath: `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`,
  };
}

export function restoreWorkspaceSnapshot(
  snapshot: WorkspaceSwitchSnapshot,
  options: {
    currentFullPath?: string;
    navigate: (to: string, opts?: { replace?: boolean }) => void;
  },
): void {
  const store = useAuthStore.getState();
  store.setWorkspaceMembership(snapshot.membershipUuid, snapshot.workspaceRole);
  if (snapshot.tenantUuid) {
    store.setTenant(
      snapshot.tenantUuid,
      snapshot.tenantId ?? "",
      snapshot.logo,
      snapshot.requestUrlName,
      snapshot.tenantSlug,
      snapshot.checkinCode,
    );
  } else {
    store.clearTenant();
  }
  if (
    options.currentFullPath === undefined ||
    options.currentFullPath !== snapshot.fullPath
  ) {
    options.navigate(snapshot.fullPath, { replace: true });
  }
  resetRelayStore();
}

export interface WorkspaceSwitchNavigationOptions {
  pathname: string;
  search?: string;
  hash?: string;
  isClient?: boolean;
  membershipUuid?: string | null;
  workspaceRole?: string | null;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

/**
 * Execute an instant, zero-reload workspace switch:
 * 1. Persist tenant selection in authStore + localStorage + recent list.
 * 2. Clear Relay's RecordSource, re-key AuthenticatedShell's route boundary,
 *    and refresh sidebar badge counts.
 * 3. Keep collection/tool routes in place or step back from record-detail URLs.
 */
export function switchWorkspace(
  target: SwitchableTenant,
  options: WorkspaceSwitchNavigationOptions,
): string {
  const prevState = useAuthStore.getState();
  rememberTenantRecent(target.uuid);
  if (options.membershipUuid !== undefined) {
    prevState.setWorkspaceMembership(
      options.membershipUuid,
      options.workspaceRole ?? null,
    );
  } else if (prevState.tenantUuid !== target.uuid && prevState.membershipUuid) {
    // Clear stale membership scoping from the previous brand when switching via
    // sidebar TenantPicker or Jump so X-Spark-Membership never mismatches X-Spark-Tenant.
    prevState.setWorkspaceMembership(null, null);
  }
  useAuthStore
    .getState()
    .setTenant(
      target.uuid,
      target.id,
      target.logo ?? null,
      target.requestUrlName ?? null,
      target.tenantSlug ?? null,
      target.checkinCode ?? null,
    );

  const nextTo = resolveWorkspaceSwitchPath(options.pathname, {
    search: options.search,
    hash: options.hash,
    isClient: options.isClient,
  });
  const currentFull = `${options.pathname}${options.search ?? ""}${options.hash ?? ""}`;
  if (nextTo !== currentFull) {
    options.navigate(nextTo, { replace: true });
  }

  resetRelayStore();
  return nextTo;
}
