import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";

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
  id: string;
  uuid: string;
  reqId: string;
  venue: string;
  locationDate: string;
  requester: string;
  type: string;
  source: "external" | "internal";
  statusNote: string;
};

async function callApprovalMutation(
  mutation: "approveRequest" | "declineRequest",
  variables: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const inputType =
    mutation === "approveRequest" ? "ApproveRequestInput" : "DeclineRequestInput";
  const body = JSON.stringify({
    query: `
      mutation Run($input: ${inputType}!) {
        ${mutation}(input: $input) {
          success
          message
        }
      }
    `,
    variables,
  });
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body,
  });
  const json = await res.json();
  if (json.errors?.length) {
    return {
      success: false,
      message: json.errors.map((e: { message: string }) => e.message).join("; "),
    };
  }
  const r = json?.data?.[mutation] ?? { success: false, message: "Unknown error." };
  return { success: !!r.success, message: r.message ?? "" };
}

/* ─────────────────── row ─────────────────── */

const ApprovalRow: React.FC<{
  row: Row;
  onView: () => void;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}> = ({ row, onView, onApprove, onDecline, busy }) => {
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
            onClick={onApprove}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✓ Approve
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm transition"
            style={{
              background: "transparent",
              color: "var(--spark-orange)",
              border: "1px solid rgba(239,90,42,0.4)",
              opacity: busy ? 0.5 : 1,
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
    { first: 300, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const rows: Row[] = useMemo(() => {
    return (
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        // Only "pending" requests need a decision. Approved and
        // declined ones are terminal — they live on the requests list,
        // not in the approval queue.
        ?.filter((n) => {
          const slug = (n.status?.slug ?? n.status?.name ?? "").toLowerCase();
          return slug === "pending";
        })
        ?.slice(0, 200)
        ?.map((n) => {
          const market =
            n.retailer?.location?.name ?? n.location?.name ?? "—";
          const stateCode = n.retailer?.location?.state?.code ?? n.state?.code;
          const date = formatDate(n.date);
          return {
            id: String(n.id),
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

  const showAlert = useAlertStore((s) => s.showAlert);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Denial modal state — captures the required comment that goes back
  // to the requestor in the decline email.
  const [declining, setDeclining] = useState<Row | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const approve = async (r: Row) => {
    if (!window.confirm(`Approve "${r.venue}"?`)) return;
    setBusyId(r.id);
    try {
      const result = await callApprovalMutation("approveRequest", {
        input: { id: r.id },
      });
      if (!result.success) throw new Error(result.message || "Approve failed.");
      showAlert(`Approved ${r.reqId}.`, "success");
      window.location.reload();
    } catch (e) {
      showAlert(`Couldn't approve: ${(e as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  };

  const submitDecline = async () => {
    if (!declining) return;
    if (declineReason.trim().length < 8) {
      showAlert(
        "Tell the requestor at least a sentence about why — they need that context to revise.",
        "warning",
      );
      return;
    }
    setBusyId(declining.id);
    try {
      const result = await callApprovalMutation("declineRequest", {
        input: { id: declining.id, declineReason: declineReason.trim() },
      });
      if (!result.success) throw new Error(result.message || "Decline failed.");
      showAlert(`Declined ${declining.reqId} — requestor notified.`, "success");
      setDeclining(null);
      setDeclineReason("");
      window.location.reload();
    } catch (e) {
      showAlert(`Couldn't decline: ${(e as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  };

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
          busy={busyId === r.id}
          onApprove={() => approve(r)}
          onDecline={() => setDeclining(r)}
          onView={() => navigate(`/request/view/${r.uuid}`)}
        />
      ))}

      {/* Decline modal — requires a comment per Kyle's spec. The
          comment goes back to the requestor in the branded decline
          email so they can revise/resubmit. */}
      {declining && (
        <div
          onClick={() => !busyId && setDeclining(null)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              DECLINE REQUEST
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Why are you declining {declining.reqId}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
            >
              This goes to <strong>{declining.requester}</strong> in the
              decline email so they can revise and resubmit. Be specific —
              "out of inventory in this market" beats "no".
            </p>
            <textarea
              autoFocus
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              placeholder="e.g., We don't have inventory in this market until Q3, please push the date."
              className="w-full mt-4 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.14em",
                color:
                  declineReason.trim().length < 8
                    ? "var(--spark-orange)"
                    : "rgba(255,255,255,0.45)",
              }}
            >
              {declineReason.trim().length < 8
                ? "AT LEAST A SENTENCE — REQUIRED"
                : `${declineReason.trim().length} CHARS`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (busyId) return;
                  setDeclining(null);
                  setDeclineReason("");
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={submitDecline}
                disabled={
                  busyId !== null || declineReason.trim().length < 8
                }
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  opacity:
                    busyId !== null || declineReason.trim().length < 8
                      ? 0.5
                      : 1,
                }}
              >
                {busyId ? "Sending…" : "Decline + send comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────── page ─────────────────── */

export default function SparkApprovals() {
  // Approvals are admin-only; route is also wrapped in AdminOnly. Keep the
  // hook usage in case it's referenced elsewhere; auth gate at route level.
  void useSparkRole;
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
