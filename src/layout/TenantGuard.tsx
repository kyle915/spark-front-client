import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { fetchQuery } from "relay-runtime";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@api/queries/__generated__/TenantQuery.graphql";
import environment from "@api/relay/environment";
import { useAuthStore } from "@store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";
import { AppShellSkeleton } from "@/layout/PageSkeletons";

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
 */
export default function TenantRoute({ component }: TenantRouteProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { tenantUuid, selectTenant } = useTenantSelection();
  const [resolving, setResolving] = useState(!tenantUuid);
  const [noTenants, setNoTenants] = useState(false);

  useEffect(() => {
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
          };
        });

        if (tenants.length === 0) {
          setNoTenants(true);
          setResolving(false);
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
  }, [tenantUuid, user?.uuid, selectTenant, logout, navigate]);

  if (resolving) {
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
          style={{ color: "rgba(255,255,255,0.85)" }}
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
