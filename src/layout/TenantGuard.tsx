import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { fetchQuery } from "relay-runtime";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@api/queries/__generated__/TenantQuery.graphql";
import environment from "@api/relay/environment";
import { useAuthStore } from "@store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";

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
      .catch((err) => {
        if (cancelled) return;
        // Only kick to login if the failure looks like a real auth
        // problem. Transient/network errors (e.g. JWT not yet
        // recognized server-side a few hundred ms after magic-link
        // exchange) trigger a single retry — bouncing the user back
        // to /login mid-sign-in is the most common loop we've seen.
        const msg = String((err as Error)?.message || "").toLowerCase();
        const looksLikeAuth =
          msg.includes("signature") ||
          msg.includes("expired") ||
          msg.includes("not authorized") ||
          msg.includes("permission");
        if (!looksLikeAuth) {
          // Soft retry once, then give up and surface the no-tenants
          // state instead of an aggressive logout.
          setTimeout(() => {
            if (cancelled) return;
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
                // Retry also failed → show no-tenants state, let user
                // logout manually if they want.
                setNoTenants(true);
                setResolving(false);
              });
          }, 600);
          return;
        }
        // Real auth failure — log out as before.
        logout();
        navigate("/login", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [tenantUuid, user?.uuid, selectTenant, logout, navigate]);

  if (resolving) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--spark-bg, #0a0d09)" }}
      >
        <div
          className="text-xs mono"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          LOADING…
        </div>
      </div>
    );
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
