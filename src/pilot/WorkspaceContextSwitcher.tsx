import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { fetchQuery, commitMutation } from "relay-runtime";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { TenantQuery } from "@/api/queries/TenantQuery";
import { switchWorkspace } from "@/layout/workspaceSwitch";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import { PilotQueriesWorkspaceContextsQuery } from "@/api/queries/PilotQueries";
import { PilotMutationsSwitchContextMutation } from "@/api/mutations/PilotMutations";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import type { PilotQueriesWorkspaceContextsQuery as ContextsQueryType } from "@/api/queries/__generated__/PilotQueriesWorkspaceContextsQuery.graphql";
import type { PilotMutationsSwitchContextMutation as SwitchMutationType } from "@/api/mutations/__generated__/PilotMutationsSwitchContextMutation.graphql";
import {
  filterVisibleWorkspaceContexts,
  formatSingleWorkspaceBadgeLabel,
  resolveActiveWorkspaceContextKey,
  workspaceContextOptionKey,
} from "./pilotHelpers";

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

async function fetchFreshTenants(
  userUuid?: string | null,
): Promise<SwitchableTenant[]> {
  const data = await fetchQuery<TenantQueryType>(
    environment,
    TenantQuery,
    userUuid ? { userUuid } : {},
    { fetchPolicy: "store-or-network" },
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

export interface WorkspaceContextSwitcherViewProps {
  contexts: readonly WorkspaceContextItem[];
  tenantUuid?: string | null;
  membershipUuid?: string | null;
  switching?: boolean;
  onSelectKey: (optionKey: string) => void;
}

export const WorkspaceContextSwitcherView: React.FC<
  WorkspaceContextSwitcherViewProps
> = ({
  contexts,
  tenantUuid = null,
  membershipUuid = null,
  switching = false,
  onSelectKey,
}) => {
  const visibleContexts = useMemo(
    () =>
      filterVisibleWorkspaceContexts(contexts, {
        tenantUuid,
        membershipUuid,
      }),
    [contexts, tenantUuid, membershipUuid],
  );

  if (visibleContexts.length === 0) {
    return null;
  }

  if (visibleContexts.length === 1) {
    const single = visibleContexts[0];
    const badgeLabel = formatSingleWorkspaceBadgeLabel(single);
    if (!badgeLabel) return null;
    return (
      <span
        data-testid="workspace-single-pill"
        className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium truncate"
        style={{
          background: "var(--spark-surface-2, rgba(var(--spark-ink-rgb),0.06))",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
          maxWidth: 220,
        }}
        title={single.displayLabel}
      >
        {badgeLabel}
      </span>
    );
  }

  const activeValue = resolveActiveWorkspaceContextKey(visibleContexts, {
    tenantUuid,
    membershipUuid,
  });

  return (
    <label className="hidden md:inline-flex items-center gap-1.5 text-xs">
      <span className="sr-only">Workspace membership context</span>
      <select
        value={activeValue}
        disabled={switching}
        onChange={(e) => onSelectKey(e.target.value)}
        aria-label="Switch workspace"
        className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
        style={{
          background: "var(--spark-field-bg, var(--spark-surface))",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
          maxWidth: 240,
        }}
      >
        {visibleContexts.map((ctx) => {
          const key = workspaceContextOptionKey(ctx);
          return (
            <option
              key={key}
              value={key}
              style={{
                background: "var(--spark-surface)",
                color: "var(--spark-text)",
              }}
            >
              {ctx.displayLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
};

/**
 * Explicit workspace & agency context switcher.
 * - Single-workspace client users see a clean, non-interactive workspace pill
 *   (never a dropdown menu or list of other brands).
 * - Multi-workspace agency or Ignite staff users get an instant zero-reload
 *   workspace switch kept 100% synchronized with the sidebar TenantPicker,
 *   with `[ARCHIVED]` workspaces filtered out.
 */
export const WorkspaceContextSwitcher: React.FC = () => {
  const { isAuthenticated, user, tenantUuid, membershipUuid } = useAuthStore();
  const { isClient } = useSparkRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [contexts, setContexts] = useState<readonly WorkspaceContextItem[]>([]);
  const [switching, setSwitching] = useState(false);
  const tenantsMapRef = useRef<Map<string, SwitchableTenant>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) {
      setContexts([]);
      tenantsMapRef.current.clear();
      return;
    }
    let cancelled = false;
    fetchQuery<ContextsQueryType>(
      environment,
      PilotQueriesWorkspaceContextsQuery,
      {},
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .then((res) => {
        if (cancelled || !res?.myWorkspaceContexts) return;
        setContexts(res.myWorkspaceContexts);
      })
      .catch(() => {
        /* non-blocking in topbar */
      });

    fetchFreshTenants(user?.uuid)
      .then((rows) => {
        if (cancelled) return;
        const nextMap = new Map<string, SwitchableTenant>();
        for (const row of rows) nextMap.set(row.uuid, row);
        tenantsMapRef.current = nextMap;
      })
      .catch(() => {
        /* external provider memberships have no TenantQuery rows */
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.uuid]);

  const visibleContexts = useMemo(
    () =>
      filterVisibleWorkspaceContexts(contexts, {
        tenantUuid,
        membershipUuid,
      }),
    [contexts, tenantUuid, membershipUuid],
  );

  const handleSelect = (nextValue: string) => {
    const chosen = visibleContexts.find(
      (c) => workspaceContextOptionKey(c) === nextValue,
    );
    if (!chosen) return;

    const cachedTenant = tenantsMapRef.current.get(chosen.tenantUuid);
    setSwitching(true);

    // Execute instant zero-reload workspace + membership switch immediately so
    // sidebar TenantPicker, topbar, Relay store, and Dashboard switch in lockstep.
    switchWorkspace(
      {
        id: cachedTenant?.id ?? "",
        uuid: chosen.tenantUuid,
        name: chosen.tenantName ?? cachedTenant?.name ?? null,
        logo: cachedTenant?.logo ?? null,
        requestUrlName: cachedTenant?.requestUrlName ?? null,
        tenantSlug: chosen.tenantSlug || cachedTenant?.tenantSlug || null,
        checkinCode: cachedTenant?.checkinCode ?? null,
      },
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        isClient,
        membershipUuid: chosen.membershipUuid ?? null,
        workspaceRole: chosen.workspaceRole,
        navigate,
      },
    );

    if (!cachedTenant) {
      void fetchFreshTenants(user?.uuid)
        .then((rows) => {
          const nextMap = new Map<string, SwitchableTenant>();
          for (const row of rows) nextMap.set(row.uuid, row);
          tenantsMapRef.current = nextMap;
          const hydrated = nextMap.get(chosen.tenantUuid);
          if (
            hydrated &&
            useAuthStore.getState().tenantUuid === chosen.tenantUuid
          ) {
            useAuthStore
              .getState()
              .setTenant(
                hydrated.uuid,
                hydrated.id,
                hydrated.logo ?? null,
                hydrated.requestUrlName ?? null,
                hydrated.tenantSlug ?? (chosen.tenantSlug || null),
                hydrated.checkinCode ?? null,
              );
          }
        })
        .catch(() => {
          /* external provider context has no TenantQuery row */
        });
    }

    commitMutation<SwitchMutationType>(environment, {
      mutation: PilotMutationsSwitchContextMutation,
      variables: {
        membershipUuid: chosen.membershipUuid ?? null,
        tenantUuid: chosen.tenantUuid,
      },
      onCompleted: () => {
        setSwitching(false);
      },
      onError: () => {
        setSwitching(false);
      },
    });
  };

  return (
    <WorkspaceContextSwitcherView
      contexts={contexts}
      tenantUuid={tenantUuid}
      membershipUuid={membershipUuid}
      switching={switching}
      onSelectKey={handleSelect}
    />
  );
};

export default WorkspaceContextSwitcher;
