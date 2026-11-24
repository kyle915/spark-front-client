import { Suspense, useMemo, useState } from "react";
import { useAllConnectionPages } from "@/hooks/useAllConnectionPages";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";

type RecentRow = NonNullable<
  NonNullable<RequestsQueryType["response"]["requests"]["edges"][number]>["node"]
>;

/**
 * "Recent submissions" — requests created in the last 7 days. Helps
 * admins track what's coming in + what's still pending approval.
 */

type Row = {
  uuid: string;
  id: string;
  reqId: string;
  venue: string;
  market: string;
  type: string;
  status: string;
  statusSlug: string;
  createdAgo: string;
  date: string;
  requester: string;
  isPending: boolean;
};

const fmtAgo = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const days = diff / 86_400_000;
    if (days < 1) {
      const hours = diff / 3_600_000;
      if (hours < 1) {
        return `${Math.max(0, Math.round(diff / 60_000))}m ago`;
      }
      return `${Math.round(hours)}h ago`;
    }
    return `${Math.round(days)}d ago`;
  } catch {
    return iso;
  }
};

const fmtDate = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
};

const STATUS_CHIP: Record<string, string> = {
  done: "chip chip-lime",
  scheduled: "chip chip-sky",
  approved: "chip chip-purple",
  queue: "chip chip-gold",
  pending: "chip chip-orange",
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline request approval. Clients (and admins) can approve a PENDING
  // request straight from this list — the backend `approveRequest` enforces
  // tenant membership + blocks BAs, so it's safe to expose to clients
  // (mirrors the client recap sign-off on /my-approvals). Raw authenticated
  // fetch (same as the admin approvals queue) so no Relay artifact is needed.
  const approveRequestRow = async (row: Row) => {
    setBusyId(row.uuid);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
        },
        body: JSON.stringify({
          query:
            "mutation Approve($input: ApproveRequestInput!) { approveRequest(input: $input) { success message } }",
          variables: { input: { id: row.id } },
        }),
      });
      const json = await res.json();
      const ok = !json.errors?.length && json?.data?.approveRequest?.success;
      if (ok) {
        setApprovedIds((prev) => new Set(prev).add(row.uuid));
      } else {
        window.alert(
          json.errors?.[0]?.message ||
            json?.data?.approveRequest?.message ||
            "Couldn't approve — please try again.",
        );
      }
    } catch {
      window.alert("Couldn't approve — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  // Only the last 7 days are shown, so ask the server for just those
  // (createdWithinHours) instead of the newest-dated 500 of everything.
  // Brand users get 200 rows a request; the hook walks the rest by cursor.
  const { nodes: recent } = useAllConnectionPages<RequestsQueryType, RecentRow>(
    RequestsQuery,
    {
      first: 500,
      filters: {
        ...(tenantId ? { tenantId } : {}),
        createdWithinHours: 7 * 24,
      },
    },
    (response) => response.requests,
  );

  const rows: Row[] = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return (
      recent
        ?.filter((n) => {
          const t = new Date(n.createdAt ?? 0).getTime();
          return t > cutoff;
        })
        ?.map((n) => {
          const slug = (n.status?.slug ?? n.status?.name ?? "pending")
            .toString()
            .toLowerCase();
          const market = n.market ?? "";
          return {
            uuid: String(n.uuid),
            id: String(n.id),
            reqId: `REQ-${String(n.id).slice(-4).toUpperCase()}`,
            venue: n.retailer?.name ?? n.name ?? "—",
            market: market || "—",
            type: n.requestType?.name ?? "Activation",
            status: n.status?.name ?? "Pending",
            statusSlug: slug,
            createdAgo: fmtAgo(n.createdAt ?? ""),
            date: fmtDate(n.date),
            requester: n.client?.name ?? "—",
            isPending: slug === "pending" || slug === "queue",
          };
        })
        ?.sort(
          (a, b) =>
            (b.createdAgo.includes("m") ? 1 : 0) -
            (a.createdAgo.includes("m") ? 1 : 0),
        ) ?? []
    );
  }, [recent]);

  const pendingCount = rows.filter((r) => r.isPending).length;

  const openRow = (r: Row) => {
    // Admin view: keep the deep-links (ops queue / edit).
    if (isAdmin) {
      navigate(r.isPending ? "/approvals" : `/request/edit/${r.uuid}`);
      return;
    }
    // Client view: open the read-only request detail (tenant-scoped,
    // client-safe). Pending requests show the inline Approve there too —
    // no admin-only wall.
    navigate(`/request/view/${r.uuid}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="spark-card p-4">
          <p className="label-mini">SUBMITTED · 7D</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {rows.length}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">AWAITING APPROVAL</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-orange)" }}
          >
            {pendingCount}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">APPROVED</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {rows.filter((r) => r.statusSlug === "approved").length}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">SCHEDULED</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-sky)" }}
          >
            {rows.filter((r) => r.statusSlug === "scheduled").length}
          </p>
        </div>
      </div>

      {/* Phones: one card per request so venue, market and date stay
          readable without sideways scrolling. */}
      <ul className="md:hidden space-y-3" aria-label="Recent submissions">
        {rows.length === 0 && (
          <li
            className="spark-card px-4 py-8 text-center text-sm"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Nothing submitted in the last 7 days.
          </li>
        )}
        {rows.map((r) => {
          const chipClass = STATUS_CHIP[r.statusSlug] ?? "chip chip-muted";
          const approved = approvedIds.has(r.uuid);
          return (
            <li key={r.uuid} className="spark-card p-4">
              <button
                type="button"
                onClick={() => openRow(r)}
                className="w-full text-left"
                style={{ background: "transparent", border: "none", padding: 0 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium min-w-0 break-words">{r.venue}</p>
                  <span className={approved ? "chip chip-purple" : chipClass}>
                    {approved ? "APPROVED" : r.status.toUpperCase()}
                  </span>
                </div>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--spark-text-secondary)" }}
                >
                  {r.market} · {r.date}
                </p>
                <p
                  className="text-xs mt-2 mono"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {r.reqId} · {r.createdAgo} · {r.requester}
                </p>
              </button>
              {r.isPending && !approved && (
                <button
                  type="button"
                  disabled={busyId === r.uuid}
                  onClick={() => approveRequestRow(r)}
                  className="mt-3 w-full text-sm font-semibold px-3 py-2 rounded-xl"
                  style={{
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    background: "transparent",
                    opacity: busyId === r.uuid ? 0.6 : 1,
                  }}
                >
                  {busyId === r.uuid ? "Approving…" : "Approve request"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div
        className="spark-card overflow-hidden hidden md:block"
        style={{ borderRadius: 20 }}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            style={{ minWidth: 900 }}
          >
            <thead
              style={{
                background: "var(--spark-surface-2)",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <tr
                className="text-left mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "var(--spark-text-meta)",
                }}
              >
                <th className="px-4 py-3">SUBMITTED</th>
                <th className="px-4 py-3">REQ ID</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">VENUE</th>
                <th className="px-4 py-3">MARKET</th>
                <th className="px-4 py-3">EVENT DATE</th>
                <th className="px-4 py-3">REQUESTOR</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    Nothing submitted in the last 7 days.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const chipClass =
                  STATUS_CHIP[r.statusSlug] ?? "chip chip-muted";
                return (
                  <tr
                    key={r.uuid}
                    className="cursor-pointer transition"
                    style={{
                      borderBottom: "1px solid var(--spark-border)",
                    }}
                    onClick={() => openRow(r)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(var(--spark-ink-rgb),0.02)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td
                      className="px-4 py-3 mono text-xs"
                      style={{ color: "var(--spark-lime)" }}
                    >
                      {r.createdAgo}
                    </td>
                    <td
                      className="px-4 py-3 mono text-xs whitespace-nowrap"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-secondary)",
                      }}
                    >
                      {r.reqId}
                    </td>
                    <td className="px-4 py-3">
                      {approvedIds.has(r.uuid) ? (
                        <span className="chip chip-purple">APPROVED</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className={chipClass}>
                            {r.status.toUpperCase()}
                          </span>
                          {r.isPending && (
                            <button
                              type="button"
                              disabled={busyId === r.uuid}
                              onClick={(e) => {
                                e.stopPropagation();
                                approveRequestRow(r);
                              }}
                              title="Approve this request"
                              className="mono text-[10px] px-2 py-1 rounded-full"
                              style={{
                                letterSpacing: "0.1em",
                                border: "1px solid var(--spark-lime)",
                                color: "var(--spark-lime)",
                                background: "transparent",
                                cursor:
                                  busyId === r.uuid ? "default" : "pointer",
                                opacity: busyId === r.uuid ? 0.6 : 1,
                              }}
                            >
                              {busyId === r.uuid ? "APPROVING…" : "APPROVE"}
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.venue}</td>
                    <td className="px-4 py-3">{r.market}</td>
                    <td className="px-4 py-3 text-xs">{r.date}</td>
                    <td className="px-4 py-3 text-xs">{r.requester}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function SparkRecentSubmissions() {
  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            LAST 7 DAYS
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Recent submissions.
          </h1>
          <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
            Every request that came in this week, sorted by submission
            time. Approve pending requests inline — no admin access needed.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading…
            </div>
          }
        >
          <Inner />
        </Suspense>
      </div>
    </Layout>
  );
}
