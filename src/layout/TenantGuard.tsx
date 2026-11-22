import { useEffect, useState, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router";
import { fetchQuery } from "relay-runtime";
import { TenantQuery } from "@/api/queries/TenantQuery";
import { PilotQueriesWorkspaceContextsQuery } from "@/api/queries/PilotQueries";
import type { TenantQuery as TenantQueryType } from "@api/queries/__generated__/TenantQuery.graphql";
import type { PilotQueriesWorkspaceContextsQuery as ContextsQueryType } from "@api/queries/__generated__/PilotQueriesWorkspaceContextsQuery.graphql";
import environment from "@api/relay/environment";
import { useAuthStore } from "@store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";
import { AppShellSkeleton } from "@/layout/PageSkeletons";
import {
  applyTenantSwitch,
  fetchSwitchableTenants,
} from "@/hooks/useAdoptRecordTenant";
import {
  TENANT_LINK_PARAM,
  decideTenantParamSwitch,
  stripTenantParam,
} from "@/lib/tenantDeepLink";

interface TenantRouteProps {
  component: ReactElement;
}

/**
 * Gate every authed route on a selected tenant.
 *
 * Auto-selects silently — no /select-company picker page. The flow:
 *   - tenantUuid already set → render immediately
 *   - no tenantUuid → fetch the user's tenants and pick one:
 *       · prefer the last-used uuid from localStorage if still in the list
 *       · otherwise the first tenant returned
 *     Then render. Admins switch tenants via the sidebar TenantPicker.
 *   - tenants fetch errors → log the user out (the legacy CompanySelector
 *     used the same posture)
 *   - 0 tenants → land on the "no companies" state with a Logout button
 *
 * Links that carry `?tenant=<uuid>` (emailed list links: "Open Walk-ups",
 * digest "Open recaps →") are resolved HERE, before the shell renders, so
 * the list never loads under the previously selected client. The value is
 * matched against the user's own switcher list only — an unknown or
 * not-permitted tenant is ignored — and the param is then stripped.
 */
export default function TenantRoute({ component }: TenantRouteProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { tenantUuid, selectTenant } = useTenantSelection();
  const [resolving, setResolving] = useState(!tenantUuid);
  const [noTenants, setNoTenants] = useState(false);
  const location = useLocation();
  const tenantParam = new URLSearchParams(location.search).get(
    TENANT_LINK_PARAM,
  );
  const { pathname, search, hash, state: locationState } = location;

  useEffect(() => {
    if (!tenantParam) return;
    let cancelled = false;
    const dropParam = () => {
      if (cancelled) return;
      navigate(
        { pathname, search: stripTenantParam(search), hash },
        { replace: true, state: locationState },
      );
    };
    fetchSwitchableTenants(environment, user?.uuid)
      .then((tenants) => {
        if (cancelled) return;
        const now = useAuthStore.getState();
        const target = decideTenantParamSwitch({
          selected: { tenantId: now.tenantId, tenantUuid: now.tenantUuid },
          param: tenantParam,
          tenants,
        });
        if (target) applyTenantSwitch(target);
        dropParam();
      })
      // Tenant list failed: keep the current client, still clean the URL.
      // (The no-tenant effect below owns the "session is dead" posture.)
      .catch(dropParam);
    return () => {
      cancelled = true;
    };
  }, [tenantParam, pathname, search, hash, locationState, user?.uuid, navigate]);

  useEffect(() => {
    // A ?tenant= link picks the client above; don't race it with the
    // last-used default. This effect re-runs once the param is stripped.
    if (tenantParam) return;
    if (tenantUuid) {
      setResolving(false);
      return;
    }
    let cancelled = false;

    const variables: TenantQueryType["variables"] = user?.uuid
      ? { userUuid: user.uuid }
      : {};

    fetchQuery<TenantQueryType>(environment, TenantQuery, variables)
      .toPromise()
      .then((data) => {
        if (cancelled) return;

        const tenants = (data?.tenants?.edges ?? []).map((edge) => {
          const t = edge.node;
          return {
            id: t.id,
            uuid: String(t.uuid),
            logo: t.image,
            requestUrlName: t.requestUrlName,
            tenantSlug: t.tenantSlug,
            checkinCode: t.checkinCode,
          };
        });

        if (tenants.length === 0) {
          // External agency / provider users intentionally have no consolidated
          // TenantedUser row; resolve their assigned workspace context instead.
          fetchQuery<ContextsQueryType>(
            environment,
            PilotQueriesWorkspaceContextsQuery,
            {},
          )
            .toPromise()
            .then((ctxData) => {
              if (cancelled) return;
              const ctxs = ctxData?.myWorkspaceContexts ?? [];
              if (ctxs.length === 0) {
                setNoTenants(true);
                setResolving(false);
                return;
              }
              const active = ctxs.find((c) => c.isCurrent) ?? ctxs[0];
              selectTenant({
                tenantUuid: active.tenantUuid,
                tenantId: "",
                tenantSlug: active.tenantSlug || null,
              });
              useAuthStore
                .getState()
                .setWorkspaceMembership(
                  active.membershipUuid ?? null,
                  active.workspaceRole,
                );
              setResolving(false);
            })
            .catch(() => {
              if (cancelled) return;
              setNoTenants(true);
              setResolving(false);
            });
          return;
        }

        const lastUuid = localStorage.getItem("@tenantUuid");
        const preferred =
          (lastUuid && tenants.find((t) => t.uuid === lastUuid)) ||
          tenants[0];
        selectTenant({
          tenantUuid: preferred.uuid,
          tenantId: preferred.id,
          logo: preferred.logo,
          requestUrlName: preferred.requestUrlName,
          tenantSlug: preferred.tenantSlug,
          checkinCode: preferred.checkinCode,
        });
        setResolving(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Same posture as the legacy CompanySelector — API failure
        // means the session probably isn't valid anymore.
        logout();
        navigate("/login", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [tenantParam, tenantUuid, user?.uuid, selectTenant, logout, navigate]);

  if (resolving || tenantParam) {
    return <AppShellSkeleton />;
  }

  if (noTenants) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
        style={{ background: "var(--spark-bg, #0a0d09)" }}
      >
        <p
          className="text-lg"
          style={{ color: "var(--spark-text)" }}
        >
          No companies associated with this account.
        </p>
        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "transparent",
            color: "rgba(255,90,42,0.95)",
            border: "1px solid rgba(255,90,42,0.4)",
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  return component;
}
