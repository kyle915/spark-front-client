import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { LinkedSheetIntegrationQuery } from "@/api/queries/LinkedSheetIntegrationQuery";
import type { LinkedSheetIntegrationQuery as LinkedSheetIntegrationQueryType } from "@/api/queries/__generated__/LinkedSheetIntegrationQuery.graphql";
import { useAuthStore } from "@/store/authStore";

const fmtWhen = (raw: string | null | undefined): string => {
  if (!raw) return "Never";
  try {
    return new Date(raw).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const reqLink = (requestId: string | null | undefined): string | null => {
  if (!requestId) return null;
  return `/request/view/${requestId}`;
};

/**
 * Admin panel showing Google Sheet append sync status per tenant.
 * Surfaces last sync time, last error, and a link to the request that
 * triggered the most recent row append.
 */
const LinkedSheetIntegrationPanel: React.FC = () => {
  const { tenantId, user } = useAuthStore();
  const userUuid = user?.uuid ?? null;
  const data = useLazyLoadQuery<LinkedSheetIntegrationQueryType>(
    LinkedSheetIntegrationQuery,
    { userUuid: userUuid ?? null },
    { fetchPolicy: "store-and-network" },
  );

  const tenant = useMemo(() => {
    const edges = data?.tenants?.edges ?? [];
    if (!tenantId) return edges[0]?.node ?? null;
    return edges.find((e) => String(e?.node?.id) === String(tenantId))?.node ?? null;
  }, [data, tenantId]);

  if (!tenant) {
    return (
      <div className="spark-card p-5 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
        Select a tenant to view sheet integration status.
      </div>
    );
  }

  const hasSheet = Boolean((tenant.linkedSheetUrl ?? "").trim());
  const lastError = (tenant.linkedSheetLastSyncError ?? "").trim();
  const lastSync = tenant.linkedSheetLastSyncAt;
  const lastReqId = tenant.linkedSheetLastRequestId;
  const status = !hasSheet
    ? "not_configured"
    : lastError
      ? "error"
      : lastSync
        ? "ok"
        : "pending";

  const statusLabel =
    status === "ok"
      ? "Synced"
      : status === "error"
        ? "Last append failed"
        : status === "pending"
          ? "Awaiting first append"
          : "No sheet linked";

  const statusColor =
    status === "ok"
      ? "var(--spark-lime)"
      : status === "error"
        ? "var(--spark-orange, #ef5a2a)"
        : "rgba(255,255,255,0.45)";

  return (
    <div className="spark-card p-5 space-y-4">
      <div>
        <p
          className="mono text-[10px] mb-1"
          style={{ letterSpacing: "0.18em", color: "var(--spark-sky)" }}
        >
          GOOGLE SHEET INTEGRATION
        </p>
        <h3 className="display text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          {tenant.name}
        </h3>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
          Spark-form and request rows append to the linked sheet automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--spark-border)" }}>
          <p className="mono text-[9px]" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}>
            STATUS
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: statusColor }}>
            {statusLabel}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--spark-border)" }}>
          <p className="mono text-[9px]" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}>
            LAST SYNC
          </p>
          <p className="text-sm font-semibold mt-1">{fmtWhen(lastSync)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--spark-border)" }}>
          <p className="mono text-[9px]" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}>
            LAST REQUEST
          </p>
          <p className="text-sm font-semibold mt-1">
            {lastReqId ? (
              <Link
                to={reqLink(lastReqId) ?? "#"}
                className="underline"
                style={{ color: "var(--spark-lime)" }}
              >
                REQ-{String(lastReqId).slice(-4).toUpperCase()}
              </Link>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {lastError ? (
        <div
          className="rounded-xl p-3 text-sm"
          style={{
            border: "1px solid rgba(239, 90, 42, 0.35)",
            background: "rgba(239, 90, 42, 0.08)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <p className="mono text-[9px] mb-1" style={{ letterSpacing: "0.14em", color: "#ef5a2a" }}>
            LAST ERROR
          </p>
          {lastError}
        </div>
      ) : null}

      {hasSheet ? (
        <a
          href={tenant.linkedSheetUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-semibold underline"
          style={{ color: "var(--spark-lime)" }}
        >
          Open linked sheet →
        </a>
      ) : (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Link a sheet in Settings below to enable auto-append from spark-form.
        </p>
      )}
    </div>
  );
};

export default LinkedSheetIntegrationPanel;
