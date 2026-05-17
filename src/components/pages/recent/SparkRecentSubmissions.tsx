import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * "Recent submissions" — requests created in the last 7 days. Helps
 * admins track what's coming in + what's still pending approval.
 */

type Row = {
  uuid: string;
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

  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const rows: Row[] = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return (
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.filter((n) => {
          const t = new Date(n.createdAt ?? 0).getTime();
          return t > cutoff;
        })
        ?.map((n) => {
          const slug = (n.status?.slug ?? n.status?.name ?? "pending")
            .toString()
            .toLowerCase();
          const stateCode =
            n.retailer?.location?.state?.code ?? n.state?.code ?? "";
          const market = [
            n.retailer?.location?.name ?? n.location?.name ?? "",
            stateCode,
          ]
            .filter(Boolean)
            .join(", ");
          return {
            uuid: String(n.uuid),
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
  }, [data]);

  const pendingCount = rows.filter((r) => r.isPending).length;

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

      <div
        className="spark-card overflow-hidden"
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
                  color: "rgba(255,255,255,0.45)",
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
                    style={{ color: "rgba(255,255,255,0.55)" }}
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
                    onClick={() =>
                      navigate(
                        r.isPending
                          ? "/approvals"
                          : `/request/edit/${r.uuid}`,
                      )
                    }
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)")
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
                      className="px-4 py-3 mono text-xs"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {r.reqId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={chipClass}>
                        {r.status.toUpperCase()}
                      </span>
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
              color: "rgba(255,255,255,0.45)",
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
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Every request that came in this week, sorted by submission
            time. Pending rows route straight to approvals on click.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
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
