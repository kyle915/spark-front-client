import React, { useEffect, useState } from "react";
import { fetchQuery, commitMutation } from "relay-runtime";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { TenantQuery } from "@/api/queries/TenantQuery";
import { rememberTenantRecent } from "@/layout/tenantPickerPrefs";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import { PilotQueriesWorkspaceContextsQuery } from "@/api/queries/PilotQueries";
import { PilotMutationsSwitchContextMutation } from "@/api/mutations/PilotMutations";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import type { PilotQueriesWorkspaceContextsQuery as ContextsQueryType } from "@/api/queries/__generated__/PilotQueriesWorkspaceContextsQuery.graphql";
import type { PilotMutationsSwitchContextMutation as SwitchMutationType } from "@/api/mutations/__generated__/PilotMutationsSwitchContextMutation.graphql";
import { applyWorkspaceContextSelection } from "./pilotHelpers";

type ContextRow = ContextsQueryType["response"]["myWorkspaceContexts"][number];

async function fetchFreshTenants(
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
 * Explicit workspace & agency context switcher for users holding multiple
 * memberships (e.g., an agency manager assigned across two brands, or an
 * internal user with distinct brand/provider roles).
 */
export const WorkspaceContextSwitcher: React.FC = () => {
  const { isAuthenticated, tenantUuid, membershipUuid } = useAuthStore();
  const [contexts, setContexts] = useState<readonly ContextRow[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
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
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, tenantUuid, membershipUuid]);

  if (contexts.length <= 1) {
    const single = contexts[0];
    if (!single?.providerName) return null;
    return (
      <span
        className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs mono"
        style={{
          background: "rgba(197,245,70,0.1)",
          color: "#c5f546",
          border: "1px solid rgba(197,245,70,0.28)",
        }}
        title={single.displayLabel}
      >
        {single.providerName}
      </span>
    );
  }

  const activeValue =
    contexts.find(
      (c) =>
        (membershipUuid && c.membershipUuid === membershipUuid) ||
        (!membershipUuid && c.tenantUuid === tenantUuid),
    )?.membershipUuid ??
    contexts.find((c) => c.isCurrent)?.membershipUuid ??
    contexts[0]?.membershipUuid ??
    "";

  const handleSelect = (nextValue: string) => {
    const chosen = contexts.find(
      (c) => (c.membershipUuid ?? `tenant:${c.tenantUuid}`) === nextValue,
    );
    if (!chosen) return;
    setSwitching(true);
    commitMutation<SwitchMutationType>(environment, {
      mutation: PilotMutationsSwitchContextMutation,
      variables: {
        membershipUuid: chosen.membershipUuid ?? null,
        tenantUuid: chosen.tenantUuid,
      },
      onCompleted: (resp) => {
        if (!resp.switchWorkspaceContext?.ok) {
          setSwitching(false);
          return;
        }
        void applyWorkspaceContextSelection(chosen, {
          store: useAuthStore.getState(),
          loadTenants: fetchFreshTenants,
          rememberRecent: rememberTenantRecent,
        }).finally(() => {
          setSwitching(false);
          window.location.reload();
        });
      },
      onError: () => {
        setSwitching(false);
      },
    });
  };

  return (
    <label className="hidden md:inline-flex items-center gap-1.5 text-xs">
      <span className="sr-only">Workspace membership context</span>
      <select
        value={activeValue}
        disabled={switching}
        onChange={(e) => handleSelect(e.target.value)}
        className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.05)",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
          maxWidth: 240,
        }}
      >
        {contexts.map((ctx) => {
          const key = ctx.membershipUuid ?? `tenant:${ctx.tenantUuid}`;
          return (
            <option
              key={key}
              value={key}
              style={{ background: "#0A0B0D", color: "#f8fafc" }}
            >
              {ctx.displayLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
};

export default WorkspaceContextSwitcher;
