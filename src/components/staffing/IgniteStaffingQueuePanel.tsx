import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { IgniteStaffingRequestsQuery } from "@/api/queries/IgniteStaffingRequestsQuery";
import type { IgniteStaffingRequestsQuery as IgniteStaffingRequestsQueryType } from "@api/queries/__generated__/IgniteStaffingRequestsQuery.graphql";
import { UpdateIgniteStaffingRequestStatusMutation } from "@/api/mutations/UpdateIgniteStaffingRequestStatusMutation";
import type { UpdateIgniteStaffingRequestStatusMutation as UpdateIgniteStaffingRequestStatusMutationType } from "@api/mutations/__generated__/UpdateIgniteStaffingRequestStatusMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";

type Row =
  IgniteStaffingRequestsQueryType["response"]["igniteStaffingRequests"][number];

const STATUS_FLOW: Record<string, string[]> = {
  pending: ["accepted", "declined"],
  accepted: ["assigned", "declined"],
  assigned: ["completed", "declined"],
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  assigned: "Assigned",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** Dark ops queue uses Spark lime; light surfaces keep high-contrast forest. */
function queueAccent(): { color: string; border: string } {
  if (typeof document === "undefined") {
    return { color: "var(--spark-lime)", border: "rgba(var(--spark-accent-rgb),0.35)" };
  }
  const theme = document.documentElement.getAttribute("data-theme");
  const isLight = theme === "light" || theme === "lemonade";
  if (isLight) {
    return { color: "#14532d", border: "rgba(20,83,45,0.35)" };
  }
  return { color: "var(--spark-lime)", border: "rgba(var(--spark-accent-rgb),0.35)" };
}

const Inner: React.FC<{
  tenantId: string | null;
  refreshKey: number;
  onBumped: () => void;
}> = ({ tenantId, refreshKey, onBumped }) => {
  const accent = queueAccent();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitStatus, busy] =
    useMutation<UpdateIgniteStaffingRequestStatusMutationType>(
      UpdateIgniteStaffingRequestStatusMutation,
    );

  const data = useLazyLoadQuery<IgniteStaffingRequestsQueryType>(
    IgniteStaffingRequestsQuery,
    { tenantId, first: 80 },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );

  const rows = useMemo(
    () => (data.igniteStaffingRequests ?? []).filter(Boolean) as Row[],
    [data],
  );

  const updateStatus = (uuid: string, status: string) => {
    commitStatus({
      variables: { input: { uuid, status } },
      onCompleted: (resp) => {
        const r = resp.updateIgniteStaffingRequestStatus;
        if (!r?.success) {
          showAlert(r?.message ?? "Could not update request.", "error");
          return;
        }
        showAlert(r.message ?? "Updated.", "success");
        onBumped();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: "var(--spark-text-meta)" }}>
        No Ignite staffing overflow requests in this view.
      </p>
    );
  }

  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      {rows.map((row) => {
        const next = STATUS_FLOW[row.status] ?? [];
        return (
          <li
            key={row.uuid}
            className="rounded-xl px-4 py-3"
            style={{
              border: "1px solid var(--spark-border)",
              background: "var(--spark-panel, rgba(var(--spark-ink-rgb),0.02))",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{row.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                  {row.tenantName}
                  {row.activationType ? ` · ${row.activationType}` : ""}
                  {` · ${row.requestedShiftCount} shift${
                    row.requestedShiftCount === 1 ? "" : "s"
                  }`}
                </p>
                {row.requestedStores.length > 0 ? (
                  <p
                    className="text-xs mt-1 line-clamp-2"
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    {row.requestedStores.slice(0, 6).join(" · ")}
                    {row.requestedStores.length > 6
                      ? ` +${row.requestedStores.length - 6} more`
                      : ""}
                  </p>
                ) : null}
              </div>
              <span
                className="mono text-[10px] shrink-0"
                style={{
                  letterSpacing: "0.12em",
                  color: accent.color,
                  border: `1px solid ${accent.border}`,
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                {(STATUS_LABEL[row.status] ?? row.status).toUpperCase()}
              </span>
            </div>
            {next.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {next.map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={busy}
                    onClick={() => updateStatus(row.uuid, st)}
                    className="spark-btn-ghost text-xs font-semibold"
                    style={
                      st === "declined"
                        ? { color: "var(--spark-orange)" }
                        : { color: accent.color }
                    }
                  >
                    → {STATUS_LABEL[st] ?? st}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

/**
 * Staff queue for Ignite overflow staffing requests (no client billing).
 */
export default function IgniteStaffingQueuePanel({
  tenantId,
}: {
  tenantId?: string | null;
}) {
  const { canToggleRole } = useSparkRole();
  const [refreshKey, setRefreshKey] = useState(0);

  if (!canToggleRole) return null;

  return (
    <section
      className="mb-6 rounded-2xl p-4 md:p-5"
      style={{
        border: "1px solid var(--spark-border)",
        background: "var(--spark-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
          >
            IGNITE STAFFING
          </p>
          <h2 className="text-base font-semibold">Overflow request queue</h2>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="spark-btn-ghost text-xs"
        >
          Refresh
        </button>
      </div>
      <Suspense
        fallback={
          <p className="text-sm py-4" style={{ color: "var(--spark-text-meta)" }}>
            Loading queue…
          </p>
        }
      >
        <Inner
          tenantId={tenantId ?? null}
          refreshKey={refreshKey}
          onBumped={() => setRefreshKey((k) => k + 1)}
        />
      </Suspense>
    </section>
  );
}