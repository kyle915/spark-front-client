import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Approvals.
 * Wireframe: spark-demo/index.html lines 987-1026 + approvalRow helper.
 */

const formatDate = (raw: string | null | undefined) => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
};

type Row = {
  uuid: string;
  reqId: string;
  venue: string;
  locationDate: string;
  requester: string;
  type: string;
  source: "external" | "internal";
  statusNote: string;
};

/* ─────────────────── row ─────────────────── */

const ApprovalRow: React.FC<{ row: Row; onView: () => void }> = ({
  row,
  onView,
}) => {
  const sourceChip =
    row.source === "external" ? (
      <span className="chip chip-sky">EXTERNAL · NEEDS CLIENT APPROVAL</span>
    ) : (
      <span className="chip chip-lime">INTERNAL · AUTO-APPROVED</span>
    );
  return (
    <div className="spark-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="spark-dot mt-2" />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {row.reqId}
              </span>
              {sourceChip}
            </div>
            <p className="font-bold text-base">{row.venue}</p>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {row.locationDate}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {row.type} · {row.requester}
            </p>
            <p
              className="mono text-[10px] mt-2"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-gold)",
              }}
            >
              {row.statusNote.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onView}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 24px rgba(197,245,70,0.35)",
            }}
          >
            ✓ Approve
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm transition"
            style={{
              background: "transparent",
              color: "var(--spark-orange)",
              border: "1px solid rgba(239,90,42,0.4)",
            }}
          >
            ✗ Decline
          </button>
          <button
            onClick={onView}
            className="px-4 py-2 rounded-xl text-sm transition"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── inner ─────────────────── */

const ApprovalsInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 50, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const rows: Row[] = useMemo(() => {
    return (
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        // Surface anything not already DONE. Real "approval status" routing
        // ships when the backend exposes a dedicated approvals stream.
        ?.filter((n) => {
          const slug = (n.status?.slug ?? n.status?.name ?? "").toLowerCase();
          return slug && slug !== "done" && slug !== "completed";
        })
        ?.slice(0, 12)
        ?.map((n) => {
          const market =
            n.retailer?.location?.name ?? n.location?.name ?? "—";
          const stateCode = n.retailer?.location?.state?.code ?? n.state?.code;
          const date = formatDate(n.date);
          return {
            uuid: String(n.uuid),
            reqId: `REQ-${String(n.id).slice(-4).toUpperCase()}`,
            venue: n.retailer?.name ?? n.name ?? "—",
            locationDate: `${[market, stateCode].filter(Boolean).join(", ")} · ${date}`,
            requester: n.client?.name ?? n.distributor?.name ?? "—",
            type: n.requestType?.name ?? "Activation",
            source: "external" as const,
            statusNote: `Awaiting review · ${n.status?.name ?? "Pending"}`,
          };
        }) ?? []
    );
  }, [data]);

  if (rows.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Nothing in the approval queue. Nice work.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <ApprovalRow
          key={r.uuid}
          row={r}
          onView={() => navigate(`/request/view/${r.uuid}`)}
        />
      ))}
    </div>
  );
};

/* ─────────────────── page ─────────────────── */

export default function SparkApprovals() {
  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              PENDING APPROVALS
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Review &amp; approve.
            </h1>
            <p
              className="mt-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              External requests route to a mapped client user. Logged-in
              submissions auto-approve. Approvals queue a job in{" "}
              <span style={{ color: "var(--spark-gold)" }}>
                Queue for Ignite
              </span>
              .
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ✉ Send admin digest
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⚙ Auto-rules
            </button>
          </div>
        </div>

        {/* How it works */}
        <div
          className="spark-card p-5"
          style={{
            borderColor: "rgba(197,245,70,0.25)",
            background:
              "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            APPROVAL ROUTING — HOW IT WORKS
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
            <div>
              <p className="font-bold">External request (no login)</p>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                → Email to mapped client user with one-click{" "}
                <span style={{ color: "var(--spark-lime)" }}>[Approve]</span> /{" "}
                <span style={{ color: "var(--spark-orange)" }}>
                  [Decline]
                </span>{" "}
                links
                <br />→ FYI email to admin team
              </p>
            </div>
            <div>
              <p className="font-bold">Internal request (logged in)</p>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                → Auto-approved
                <br />→ Email confirmation to admin team
              </p>
            </div>
            <div>
              <p className="font-bold">Daily digest</p>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                → Cron sends end-of-day summary to admins
                <br />→ Pending / approved / declined counts
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">PENDING</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-orange)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">APPROVED · 30D</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">SLA</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">AUTO-APPROVED</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
        </div>

        {/* Queue */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading approvals…
            </div>
          }
        >
          <ApprovalsInner />
        </Suspense>
      </div>
    </Layout>
  );
}
