import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { ActivityLogsQuery } from "@/api/queries/ActivityLogsQuery";
import type { ActivityLogsQuery as ActivityLogsQueryType } from "@/api/queries/__generated__/ActivityLogsQuery.graphql";

/**
 * /audit — tenant-wide activity feed for support / compliance
 * debugging. Lists the last 200 RequestActivityLog rows (created,
 * status changed, BA invited, recap filed, nudge sent, etc.)
 * across every request in the active tenant.
 *
 * Filter chip set narrows by `kind`. No pagination yet — 200 rows
 * fits in one viewport at admin scale.
 */

const KIND_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  status_changed: "Status changed",
  ba_invited: "BA invited",
  ba_accepted: "BA accepted",
  ba_declined: "BA declined",
  ba_removed: "BA removed",
  recap_filed: "Recap filed",
  cloned_from: "Cloned",
  note_added: "Note added",
  nudge_sent: "Nudge sent",
};

const KIND_COLORS: Record<string, string> = {
  created: "rgba(95,184,239,0.18)",
  updated: "rgba(197,245,70,0.15)",
  status_changed: "rgba(239,90,42,0.18)",
  ba_invited: "rgba(180,120,255,0.18)",
  ba_accepted: "rgba(95,239,142,0.18)",
  ba_declined: "rgba(239,90,42,0.18)",
  ba_removed: "rgba(239,90,42,0.18)",
  recap_filed: "rgba(95,184,239,0.18)",
  cloned_from: "rgba(255,255,255,0.08)",
  note_added: "rgba(255,255,255,0.08)",
  nudge_sent: "rgba(197,245,70,0.15)",
};

const Inner: React.FC = () => {
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const data = useLazyLoadQuery<ActivityLogsQueryType>(
    ActivityLogsQuery,
    { first: 200, kind: kindFilter },
    { fetchPolicy: "store-and-network" },
  );

  const rows = useMemo(() => data.activityLogs ?? [], [data]);

  const kinds = useMemo(() => Object.keys(KIND_LABELS), []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          AUDIT · {rows.length} EVENTS
        </p>
        <h1
          className="display text-3xl font-bold mt-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Activity log.
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Who did what, when. Last 200 events across every request in
          this tenant.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setKindFilter(null)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
          style={{
            background: !kindFilter
              ? "var(--spark-lime, #c5f546)"
              : "rgba(255,255,255,0.06)",
            color: !kindFilter ? "#0a0d09" : "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          All
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k === kindFilter ? null : k)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={{
              background:
                k === kindFilter
                  ? "var(--spark-lime, #c5f546)"
                  : KIND_COLORS[k] ?? "rgba(255,255,255,0.06)",
              color: k === kindFilter ? "#0a0d09" : "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {rows.length === 0 ? (
          <div
            className="text-sm text-center px-6 py-12"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No activity yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <th className="text-left px-4 py-2 font-normal">When</th>
                <th className="text-left px-4 py-2 font-normal">Kind</th>
                <th className="text-left px-4 py-2 font-normal">Summary</th>
                <th className="text-left px-4 py-2 font-normal">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.uuid}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <td
                    className="px-4 py-2"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{
                        background:
                          KIND_COLORS[row.kind] ?? "rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                    >
                      {KIND_LABELS[row.kind] ?? row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2">{row.summary || "—"}</td>
                  <td
                    className="px-4 py-2"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {row.actorName ?? row.actorEmail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const AuditPage: React.FC = () => (
  <Layout>
    <Suspense
      fallback={
        <div
          className="text-sm py-12 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Loading audit feed…
        </div>
      }
    >
      <Inner />
    </Suspense>
  </Layout>
);

export default AuditPage;
