import { Link } from "react-router";
import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";

/**
 * "Upcoming events" — next 7 days, grouped by day. Combines two sources:
 *  - Approved/scheduled events from EventsQuery (event row already exists)
 *  - Pending/queue/approved requests from RequestsQuery (no event row yet)
 * so admins see what's locked in AND what's still working through approval.
 */

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const fmtTime12 = (raw: string | null | undefined): string => {
  if (!raw) return "";
  // raw may be a full venue-local datetime ("2026-05-29T07:00:00") or "HH:MM".
  // Grab the time-of-day so split(":") doesn't read the date as the hour.
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hh = parseInt(match[1], 10);
  const mm = match[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
};

type Row = {
  uuid: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  retailer: string;
  status: string;
  source: "event" | "request";
  isToday: boolean;
  isPending: boolean;
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const end = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d;
  }, [today]);

  const fmtIso = (d: Date) => d.toISOString().slice(0, 10);

  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      first: 200,
      filters: tenantId
        ? { tenantId, startDate: fmtIso(today), endDate: fmtIso(end) }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const requestsData = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    // 1. Scheduled / approved events with a real event row.
    const events =
      eventsData?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const n of events) {
      if (!n.date) continue;
      const d = new Date(n.date);
      if (d < today || d > end) continue;
      out.push({
        uuid: String(n.uuid),
        name: n.name ?? "Untitled",
        date: n.date,
        startTime: fmtTime12(n.startTime),
        endTime: fmtTime12(n.endTime),
        retailer: n.request?.retailer?.name ?? n.address ?? "—",
        status: n.status?.name ?? "Scheduled",
        source: "event",
        isToday: d.toDateString() === today.toDateString(),
        isPending: false,
      });
    }

    // 2. Pending/queue/approved requests in the same window that haven't
    //    been promoted to events yet. Avoid duplicates by checking the
    //    event.uuid set we already added.
    const seenEventUuids = new Set(out.map((r) => r.uuid));
    const requests =
      requestsData?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of requests) {
      if (!r.date) continue;
      const d = new Date(r.date);
      if (d < today || d > end) continue;
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      // Skip rows already covered by events query and skip done/declined.
      if (r.event?.uuid && seenEventUuids.has(String(r.event.uuid))) continue;
      if (slug === "done" || slug === "completed" || slug === "declined") continue;
      out.push({
        uuid: String(r.uuid),
        name: r.retailer?.name ?? r.name ?? "Untitled",
        date: r.date,
        startTime: r.startTime ? fmtTime12(r.startTime) : "",
        endTime: r.endTime ? fmtTime12(r.endTime) : "",
        retailer: r.retailer?.name ?? r.address ?? "—",
        status: r.status?.name ?? "Pending",
        source: "request",
        isToday: d.toDateString() === today.toDateString(),
        isPending: slug === "pending" || slug === "queue",
      });
    }

    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [eventsData, requestsData, today, end]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  if (groups.length === 0) {
    return (
      <SparkEmptyState
        title="Nothing on the schedule for the next 7 days."
        body="New requests show here once they're approved or pending."
        action={
          <>
            <Link
              to="/requests/create"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
            >
              Create a request
            </Link>
            <Link
              to="/requests/list"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
            >
              Open the tracker
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([key, items]) => {
        const d = new Date(key);
        const isToday = d.toDateString() === today.toDateString();
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-3">
              <h3
                className="display text-lg font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                {fmtDay(d)}
                {isToday && (
                  <span
                    className="mono text-[10px] ml-2"
                    style={{
                      letterSpacing: "0.18em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    · TODAY
                  </span>
                )}
              </h3>
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {items.length} ITEM{items.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((r) => {
                const color = r.isToday
                  ? "var(--spark-lime)"
                  : r.isPending
                    ? "var(--spark-orange)"
                    : "var(--spark-sky)";
                return (
                  <div
                    key={`${r.source}-${r.uuid}`}
                    onClick={() => {
                      // Event rows → event detail.
                      // Request rows → Spark v2 request detail
                      // (pending or approved). The detail page surfaces
                      // approve/decline inline when needed, so we
                      // don't have to fork the click target by status.
                      if (r.source === "event") {
                        navigate(`/event/view/${r.uuid}`);
                      } else {
                        navigate(`/request/view/${r.uuid}`, {
                          state: { from: "/upcoming" },
                        });
                      }
                    }}
                    className="spark-card hov p-4 cursor-pointer flex items-center gap-4"
                  >
                    <div
                      className="shrink-0 w-1 self-stretch rounded-full"
                      style={{
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{r.name}</p>
                      <p
                        className="mono text-[10px] uppercase mt-0.5 truncate"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.55)",
                        }}
                      >
                        {r.retailer}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {r.startTime || "—"}
                        {r.endTime ? ` – ${r.endTime}` : ""}
                      </p>
                      <p
                        className="mono text-[10px] mt-0.5"
                        style={{
                          letterSpacing: "0.14em",
                          color,
                        }}
                      >
                        {r.status.toUpperCase()}
                        {r.source === "request" && (
                          <span style={{ opacity: 0.7 }}> · NO EVENT YET</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function SparkUpcomingEvents() {
  const { isClient } = useSparkRole();
  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              NEXT 7 DAYS · APPROVED + PENDING
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              {isClient ? "Your upcoming activations." : "Upcoming events."}
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Approved events + pending approvals in the next 7 days,
              grouped by day. Click a row to open the event.
            </p>
          </div>
          <LinkedSheetChip />
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
