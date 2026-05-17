import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";

/**
 * "Upcoming events" — next 7 days, grouped by day. Shows event info,
 * BA assignment, and link to detail. Visible to both admin + client.
 */

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const fmtTime12 = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const [h, m] = raw.split(":");
  const hh = parseInt(h ?? "0", 10);
  const mm = m ?? "00";
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
};

type Row = {
  uuid: string;
  name: string;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  retailer: string;
  state: string;
  status: string;
  isToday: boolean;
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

  const data = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      first: 200,
      filters: tenantId
        ? {
            tenantId,
            startDate: fmtIso(today),
            endDate: fmtIso(end),
          }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const rows: Row[] = useMemo(() => {
    return (
      data?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.filter((n) => {
          if (!n.date) return false;
          const d = new Date(n.date);
          return d >= today && d <= end;
        })
        ?.map((n) => {
          const d = new Date(n.date!);
          return {
            uuid: String(n.uuid),
            name: n.name ?? "Untitled",
            date: n.date ?? "",
            dateLabel: fmtDay(d),
            startTime: fmtTime12(n.startTime),
            endTime: fmtTime12(n.endTime),
            retailer: n.request?.retailer?.name ?? n.address ?? "—",
            state: "",
            status: n.status?.name ?? "Scheduled",
            isToday: d.toDateString() === today.toDateString(),
          };
        })
        ?.sort((a, b) => a.date.localeCompare(b.date)) ?? []
    );
  }, [data, today, end]);

  // Group by day
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
      <div
        className="spark-card p-10 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Nothing on the schedule for the next 7 days.
      </div>
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
                {items.length} EVENT{items.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.uuid}
                  onClick={() => navigate(`/event/view/${r.uuid}`)}
                  className="spark-card hov p-4 cursor-pointer flex items-center gap-4"
                >
                  <div
                    className="shrink-0 w-1 self-stretch rounded-full"
                    style={{
                      background: r.isToday
                        ? "var(--spark-lime)"
                        : "var(--spark-sky)",
                      boxShadow: r.isToday
                        ? "0 0 8px var(--spark-lime)"
                        : "0 0 6px var(--spark-sky)",
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
                      {r.state ? ` · ${r.state}` : ""}
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
                        color: r.isToday
                          ? "var(--spark-lime)"
                          : "var(--spark-sky)",
                      }}
                    >
                      {r.status.toUpperCase()}
                    </p>
                  </div>
                </div>
              ))}
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
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            NEXT 7 DAYS
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {isClient ? "Your upcoming activations." : "Upcoming events."}
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Every event in the next 7 days, grouped by day. Click any row
            for the full brief.
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
