import { useEffect, useState, useCallback, type ReactElement } from "react";
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

type Tenant = {
  id: string;
  uuid: string;
  logo: string | null | undefined;
  requestUrlName: string | null | undefined;
  tenantSlug: string | null | undefined;
};

function parseTenants(data: TenantQueryType["response"] | null | undefined): Tenant[] {
  return (data?.tenants?.edges ?? []).map((edge) => {
    const t = edge.node;
    return {
      id: t.id,
      uuid: String(t.uuid),
      logo: t.image,
      requestUrlName: t.requestUrlName,
      tenantSlug: t.tenantSlug,
    };
  });
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
 *
 * Three terminal failure shapes we distinguish (so we don't lie to the
 * user about why they can't get in):
 *   1. Auth error → bounce to /login (real session problem)
 *   2. Other query error (network, schema, transient 5xx) → "Couldn't
 *      load companies" panel with explicit Retry + Log out buttons. We
 *      do NOT show "No companies" here — that message implies an
 *      assignment problem and sends the user (or a client) down a wild
 *      goose chase when the actual problem is on the wire.
 *   3. Query succeeded, returned 0 tenants → "No companies" panel.
 *      This is the only path that shows that message.
 */
export default function TenantRoute({ component }: TenantRouteProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { tenantUuid, selectTenant } = useTenantSelection();
  const [resolving, setResolving] = useState(!tenantUuid);
  const [noTenants, setNoTenants] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setNoTenants(false);
    setLoadError(null);
    setResolving(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (tenantUuid) {
      setResolving(false);
      return;
    }
    let cancelled = false;

    const variables: TenantQueryType["variables"] = user?.uuid
      ? { userUuid: user.uuid }
      : {};

    const applyTenants = (tenants: Tenant[]) => {
      if (tenants.length === 0) {
        setNoTenants(true);
        setResolving(false);
        return;
      }
      const lastUuid = localStorage.getItem("@tenantUuid");
      const preferred =
        (lastUuid && tenants.find((t) => t.uuid === lastUuid)) || tenants[0];
      selectTenant({
        tenantUuid: preferred.uuid,
        tenantId: preferred.id,
        logo: preferred.logo,
        requestUrlName: preferred.requestUrlName,
        tenantSlug: preferred.tenantSlug,
      });
      setResolving(false);
    };

    fetchQuery<TenantQueryType>(environment, TenantQuery, variables)
      .toPromise()
      .then((data) => {
        if (cancelled) return;
        applyTenants(parseTenants(data));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = String((err as Error)?.message || "").toLowerCase();
        const looksLikeAuth =
          msg.includes("signature") ||
          msg.includes("expired") ||
          msg.includes("not authorized") ||
          msg.includes("permission");
        if (looksLikeAuth) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        // Transient/network/schema error. Soft retry once. If that also
        // fails we surface a retry-able error state — not "No companies."
        setTimeout(() => {
          if (cancelled) return;
          fetchQuery<TenantQueryType>(environment, TenantQuery, variables)
            .toPromise()
            .then((data) => {
              if (cancelled) return;
              applyTenants(parseTenants(data));
            })
            .catch((retryErr) => {
              if (cancelled) return;
              const retryMsg = String((retryErr as Error)?.message || "");
              // eslint-disable-next-line no-console
              console.warn(
                "[TenantGuard] tenants query failed after retry:",
                retryMsg,
                retryErr,
              );
              setLoadError(retryMsg || "Couldn't load companies. Please try again.");
              setResolving(false);
            });
        }, 600);
      });

    return () => {
      cancelled = true;
    };
    // attempt is in deps so calling retry() triggers a fresh fetch.
  }, [tenantUuid, user?.uuid, selectTenant, logout, navigate, attempt]);

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

  if (loadError) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
        style={{ background: "var(--spark-bg, #0a0d09)" }}
      >
        <p
          className="text-lg"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Couldn't load your companies.
        </p>
        <p
          className="text-xs mono"
          style={{
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.45)",
            maxWidth: "32rem",
            textAlign: "center",
          }}
        >
          {loadError}
        </p>
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime, #c5f546)",
              color: "#0a0d09",
            }}
          >
            Try again
          </button>
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
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Try again
          </button>
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
      </div>
    );
  }

  return component;
}
