import { Suspense, useMemo, useState } from "react";
import { useAllConnectionPages } from "@/hooks/useAllConnectionPages";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

type AlertRequestNode = NonNullable<
  NonNullable<RequestsQueryType["response"]["requests"]["edges"][number]>["node"]
>;

/**
 * Spark v2 — Alerts / Notifications.
 *
 * Built from the requests dataset (no separate feed yet). Surfaces:
 *  - new submissions in the last 48h
 *  - recent approvals + declines (status updated in the last 48h)
 *
 * "Read" state is tracked per-user in localStorage so a refresh doesn't
 * un-read everything. When a real notifications backend ships, swap the
 * derive() body — the UI shape stays.
 */

type NotifKind = "request" | "approval" | "decline";

type Row = {
  key: string;
  uuid: string;
  kind: NotifKind;
  title: string;
  body: string;
  whenIso: string;
  unread: boolean;
};

const KIND_ICON: Record<NotifKind, string> = {
  request: "✉",
  approval: "✓",
  decline: "✗",
};

const KIND_COLOR: Record<NotifKind, string> = {
  request: "var(--spark-sky)",
  approval: "var(--spark-lime)",
  decline: "var(--spark-orange)",
};

const READ_KEY = "@spark.alerts.readKeys.v1";

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveRead(set: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota */
  }
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Same 300 rows as before; brand users get 200 a request, so the hook
  // walks the rest by cursor.
  const { nodes: requestNodes } = useAllConnectionPages<RequestsQueryType, AlertRequestNode>(
    RequestsQuery,
    { first: 300, filters: tenantId ? { tenantId } : null },
    (response) => response.requests,
  );

  const [readKeys, setReadKeys] = useState<Set<string>>(() => loadRead());

  const rows: Row[] = useMemo(() => {
    const all = requestNodes;

    const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
    const out: Row[] = [];

    for (const n of all) {
      const slug = (n.status?.slug ?? n.status?.name ?? "").toLowerCase();
      const requester = n.client?.name ?? n.distributor?.name ?? "Someone";
      const venue = n.retailer?.name ?? n.name ?? "an account";
      const locTag = n.market ?? "";
      const created = n.createdAt
        ? new Date(n.createdAt).getTime()
        : Number.NaN;
      const updated = n.updatedAt
        ? new Date(n.updatedAt).getTime()
        : Number.NaN;
      const id = String(n.id);
      const reqLabel = `REQ-${id.slice(-4).toUpperCase()}`;

      // New submission (pending in the last 48h)
      if (slug === "pending" && Number.isFinite(created) && created >= cutoffMs) {
        const key = `req:${id}:${n.createdAt}`;
        out.push({
          key,
          uuid: String(n.uuid),
          kind: "request",
          title: `${requester} submitted ${reqLabel}`,
          body: `${venue}${locTag ? ` · ${locTag}` : ""}`,
          whenIso: n.createdAt ?? "",
          unread: !readKeys.has(key),
        });
      }

      // Approval/decline in the last 48h
      if (
        (slug === "approved" || slug === "declined") &&
        Number.isFinite(updated) &&
        updated >= cutoffMs &&
        // skip auto-approves that fire at creation time
        Number.isFinite(created) &&
        updated - created > 5_000
      ) {
        const kind: NotifKind = slug === "approved" ? "approval" : "decline";
        const key = `${kind}:${id}:${n.updatedAt}`;
        out.push({
          key,
          uuid: String(n.uuid),
          kind,
          title:
            kind === "approval"
              ? `${reqLabel} approved`
              : `${reqLabel} declined — requestor notified`,
          body: `${venue}${locTag ? ` · ${locTag}` : ""}`,
          whenIso: n.updatedAt ?? "",
          unread: !readKeys.has(key),
        });
      }
    }

    out.sort(
      (a, b) =>
        new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime(),
    );
    return out.slice(0, 60);
  }, [requestNodes, readKeys]);

  const unread = rows.filter((r) => r.unread).length;

  const markRead = (key: string) => {
    setReadKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveRead(next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadKeys((prev) => {
      const next = new Set(prev);
      for (const r of rows) next.add(r.key);
      saveRead(next);
      return next;
    });
  };

  const openRow = (r: Row) => {
    markRead(r.key);
    if (r.kind === "request") {
      navigate("/approvals");
    } else {
      navigate(`/request/view/${r.uuid}`);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            {unread} UNREAD · LAST 48H
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            What you missed.
          </h1>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="mono text-[10px] px-3 py-2 rounded-xl"
            style={{
              letterSpacing: "0.18em",
              background: "rgba(var(--spark-ink-rgb),0.04)",
              color: "var(--spark-text-secondary)",
              border: "1px solid var(--spark-border)",
            }}
          >
            MARK ALL READ
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <SparkEmptyState
          title="Quiet on the wire."
          body="Nothing new in the last 48 hours."
        />
      ) : (
        <div className="spark-card overflow-hidden">
          <ul>
            {rows.map((r, i) => {
              const color = KIND_COLOR[r.kind];
              return (
                <li
                  key={r.key}
                  className="px-5 py-4 transition cursor-pointer"
                  onClick={() => openRow(r)}
                  style={{
                    borderBottom:
                      i < rows.length - 1
                        ? "1px solid var(--spark-border)"
                        : "none",
                    background: r.unread
                      ? "rgba(var(--spark-ink-rgb),0.015)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(var(--spark-ink-rgb),0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = r.unread
                      ? "rgba(var(--spark-ink-rgb),0.015)"
                      : "transparent")
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mono"
                      style={{
                        background: `${color}1a`,
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {KIND_ICON[r.kind]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p
                          className="font-semibold text-sm"
                          style={{
                            color: r.unread
                              ? "var(--spark-text)"
                              : "rgba(var(--spark-ink-rgb),0.7)",
                          }}
                        >
                          {r.title}
                        </p>
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "var(--spark-text-meta)",
                          }}
                        >
                          · {timeAgo(r.whenIso).toUpperCase()}
                        </span>
                      </div>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--spark-text-meta)" }}
                      >
                        {r.body}
                      </p>
                    </div>
                    {r.unread && (
                      <span
                        className="spark-dot mt-2"
                        style={{
                          width: 8,
                          height: 8,
                          background: color,
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function SparkAlerts() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-4xl"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading alerts…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
