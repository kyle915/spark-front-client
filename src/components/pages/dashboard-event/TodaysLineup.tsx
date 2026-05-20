import React, { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { TodaysLineupQuery } from "@/api/queries/TodaysLineupQuery";
import type { TodaysLineupQuery as TodaysLineupQueryType } from "@api/queries/__generated__/TodaysLineupQuery.graphql";

/**
 * Live "today's lineup" tile on the dashboard. One row per scheduled
 * event today, ordered by start time, with assigned BAs and a
 * recap-state chip. Click a row → event detail.
 *
 * Hides the entire tile (returns null) when there's nothing scheduled
 * for today — the dashboard already has a "Today's Snapshot" priority
 * card; this widget is for ops day-of awareness, not empty filler.
 */

type LineupRow = {
  eventId: string;
  eventUuid: string;
  venue: string;
  timeLabel: string;
  startMs: number;
  address: string;
  statusSlug: string;
  recapCount: number;
  bas: { name: string; accepted: boolean }[];
};

const fmtTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined,
): { label: string; startMs: number } => {
  if (!start) return { label: "—", startMs: Number.MAX_SAFE_INTEGER };
  try {
    const s = new Date(start);
    const fmt = (d: Date) =>
      d
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
        .replace(":00", "");
    if (!end) return { label: fmt(s), startMs: s.getTime() };
    const e = new Date(end);
    return { label: `${fmt(s)} – ${fmt(e)}`, startMs: s.getTime() };
  } catch {
    return { label: start, startMs: Number.MAX_SAFE_INTEGER };
  }
};

const baLabel = (n: { firstName?: string | null; lastName?: string | null; email?: string | null }): string =>
  [n.firstName, n.lastName].filter(Boolean).join(" ").trim() ||
  n.email ||
  "BA";

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const iso = useMemo(todayIso, []);
  const data = useLazyLoadQuery<TodaysLineupQueryType>(
    TodaysLineupQuery,
    {
      tenantId: tenantId ?? "",
      startDate: iso,
      endDate: iso,
    },
    { fetchPolicy: "store-or-network" },
  );

  const rows: LineupRow[] = useMemo(() => {
    const eventNodes = (data?.events?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    const aeNodes = (data?.ambassadorEvents?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n));

    // Group BA assignments by event id so we can attach them to the
    // corresponding event row in O(N+M).
    const byEvent = new Map<
      string,
      { name: string; accepted: boolean }[]
    >();
    for (const ae of aeNodes) {
      const key = String(ae.eventId);
      const list = byEvent.get(key) ?? [];
      list.push({
        name: baLabel(ae.ambassador?.user ?? {}),
        accepted: Boolean(ae.isApproved),
      });
      byEvent.set(key, list);
    }

    return eventNodes
      .map((e) => {
        const { label, startMs } = fmtTimeRange(e.startTime, e.endTime);
        return {
          eventId: String(e.id),
          eventUuid: String(e.uuid),
          venue: e.retailer?.name || e.name || "Untitled",
          timeLabel: label,
          startMs,
          address: e.address || "",
          statusSlug: e.status?.slug ?? "",
          recapCount: (e.recaps ?? []).length,
          bas: byEvent.get(String(e.id)) ?? [],
        };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [data]);

  if (rows.length === 0) return null;

  return (
    <div className="spark-card p-5" style={{ borderRadius: 20 }}>
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <h3 className="display text-lg font-bold">Today's lineup</h3>
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-lime)",
            }}
          >
            ● LIVE
          </span>
        </div>
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {rows.length} ACTIVATION{rows.length === 1 ? "" : "S"}
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => {
          const accepted = r.bas.filter((b) => b.accepted).length;
          const invited = r.bas.length;
          const recapFiled = r.recapCount > 0;
          return (
            <li
              key={r.eventId}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/event/view/${r.eventUuid}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/event/view/${r.eventUuid}`);
                }
              }}
              className="rounded-xl px-3 py-2.5 cursor-pointer transition flex items-center gap-3 flex-wrap"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--spark-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
              }
            >
              <span
                className="mono text-xs tab-num shrink-0"
                style={{
                  letterSpacing: "0.06em",
                  color: "rgba(255,255,255,0.85)",
                  minWidth: 90,
                }}
              >
                {r.timeLabel}
              </span>
              <span
                className="text-sm font-medium flex-1 min-w-0 truncate"
                style={{ color: "var(--spark-text)" }}
              >
                {r.venue}
              </span>
              {invited > 0 && (
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color:
                      accepted === invited
                        ? "var(--spark-lime)"
                        : "var(--spark-orange)",
                  }}
                  title={r.bas.map((b) => b.name).join(", ")}
                >
                  {accepted}/{invited} BA
                </span>
              )}
              {invited === 0 && (
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-orange)",
                  }}
                >
                  NO BA
                </span>
              )}
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: recapFiled
                    ? "var(--spark-lime)"
                    : "rgba(255,255,255,0.35)",
                }}
              >
                {recapFiled
                  ? `● RECAP ×${r.recapCount}`
                  : "◌ RECAP DUE"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const TodaysLineup: React.FC = () => (
  <Suspense fallback={null}>
    <Inner />
  </Suspense>
);

export default TodaysLineup;
