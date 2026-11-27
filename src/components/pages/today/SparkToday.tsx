import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import { useAllEventPages } from "@/hooks/useAllEventPages";
import { addDaysIso, opsTodayIso, venueDayOf } from "@/utils/venueDay";
import { RecentLocationPingsQuery } from "@/api/queries/RecentLocationPingsQuery";
import type { RecentLocationPingsQuery as RecentLocationPingsQueryType } from "@api/queries/__generated__/RecentLocationPingsQuery.graphql";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import { showsMissingRecaps } from "@/field/missingRecaps";
import ErrorBoundary from "@/components/ErrorBoundary";
import useBaLabel from "@/hooks/useBaLabel";
import { SparkBentoTile } from "@/shared/SparkStatBlocks";
import { todayGroundKpis, todayShowsGroundTiles } from "@/shared/sparkStat";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { SCHEDULE_HUB_TABS } from "@/shared/sparkHubNav";
import TodayMapView, { MapLegend, StatusPin } from "./TodayMapView";
import {
  STATUS_META,
  baMarkers,
  buildTodayEvents,
  eventPins,
  fitKey as pinSetKey,
  mapCoverage,
  peopleLines,
  todayCounts,
  type BoardRow,
  type ListedEvent,
  type PingRow,
  type TodayEvent,
} from "./todayMap";

/**
 * Today: every event on today's board as a pin and a row. The pin and the
 * row say the same thing (one status per event), and each leads to the
 * other. All of the deciding happens in todayMap.ts.
 */

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const plural = (n: number, one: string, many: string): string =>
  n === 1 ? one : many;

/** Live queue counts that already exist. Not a new KPI. */
function TodayQueueLine() {
  const counts = useSidebarCounts();
  const { tenantSlug, tenantMeta } = useAuthStore();
  const missingOn = showsMissingRecaps(tenantSlug, tenantMeta?.requestUrlName);
  const parts: { to: string; text: string }[] = [
    {
      to: "/recaps/list?status=needs_review",
      text: `${counts.recapsNeedsReview.toLocaleString("en-US")} ${
        counts.recapsNeedsReview === 1 ? "recap needs review" : "recaps need review"
      }`,
    },
  ];
  if (missingOn) {
    parts.push({
      to: "/recaps/missing",
      text: `${counts.recapsDue.toLocaleString("en-US")} missing ${
        counts.recapsDue === 1 ? "recap" : "recaps"
      }`,
    });
  }
  parts.push({
    to: "/approvals",
    text: `${counts.approvals.toLocaleString("en-US")} ${
      counts.approvals === 1 ? "approval" : "approvals"
    }`,
  });
  return (
    <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
      {parts.map((part, index) => (
        <span key={part.to}>
          {index > 0 ? " · " : null}
          <Link to={part.to} className="underline" style={{ color: "var(--spark-text)" }}>
            {part.text}
          </Link>
        </span>
      ))}
    </p>
  );
}

function EventRow({
  event,
  selected,
  people,
  onShowOnMap,
  rowRef,
}: {
  event: TodayEvent;
  selected: boolean;
  people: string[];
  onShowOnMap: (uuid: string) => void;
  rowRef: (el: HTMLLIElement | null) => void;
}) {
  const onMap = event.position !== null;
  const noShow = event.status === "no_show";
  const body = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">
        <StatusPin status={event.status} size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{event.name}</p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{
            color:
              noShow || event.status === "late"
                ? "var(--spark-orange)"
                : "var(--spark-text-secondary)",
          }}
        >
          {STATUS_META[event.status].label}
          {event.place ? (
            <span style={{ color: "var(--spark-text-meta)" }}> · {event.place}</span>
          ) : null}
        </p>
        {event.address ? (
          <p
            className="text-xs mt-1 truncate"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {event.address}
          </p>
        ) : null}
        {people.map((line, i) => (
          <p
            key={`${i}-${line}`}
            className="text-xs mt-1 truncate"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {line}
          </p>
        ))}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {event.startLabel || "No time"}
        </p>
        {event.endLabel ? (
          <p
            className="text-xs mt-0.5 tabular-nums"
            style={{ color: "var(--spark-text-meta)" }}
          >
            to {event.endLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
  return (
    <li
      ref={rowRef}
      aria-current={selected ? "true" : undefined}
      style={{
        borderBottom: "1px solid var(--spark-border)",
        background: selected ? "rgba(var(--spark-ink-rgb), 0.04)" : undefined,
        boxShadow: selected ? "inset 3px 0 0 var(--spark-text)" : undefined,
      }}
    >
      {onMap ? (
        <button
          type="button"
          onClick={() => onShowOnMap(event.uuid)}
          title="Show on the map"
          className="spark-row-hover block w-full text-left px-4 pt-3 pb-1.5 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2"
          style={{ color: "var(--spark-text)", outlineColor: "var(--spark-text)" }}
        >
          {body}
        </button>
      ) : (
        <div className="px-4 pt-3 pb-1.5">{body}</div>
      )}
      <p
        className="flex flex-wrap gap-x-3 px-4 pb-3 pl-12 text-xs"
        style={{ color: "var(--spark-text-meta)" }}
      >
        {onMap ? null : <span>No map position</span>}
        <Link
          to={`/event/view/${event.uuid}`}
          className="underline"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          Open event
        </Link>
      </p>
    </li>
  );
}

const Inner: React.FC<{ apiKey: string | undefined }> = ({ apiKey }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isClient } = useSparkRole();
  const baLabel = useBaLabel();
  const nameOf = useCallback((name: string) => baLabel(name), [baLabel]);

  // The ops day (Pacific), the same "today" the live board uses, never the
  // viewer's browser day.
  const today = useMemo(() => opsTodayIso(), []);

  // The API filters by the UTC day; a venue's day spans that day and the
  // next (an evening shift out west is stored on the next UTC date), so ask
  // for a day either side and keep the venue's day below.
  const { events: todaysEvents } = useAllEventPages({
    ...(tenantId ? { tenantId } : {}),
    startDate: addDaysIso(today, -1),
    endDate: addDaysIso(today, 1),
  });

  const listed: ListedEvent[] = useMemo(() => {
    return (
      todaysEvents
        .filter((n) => venueDayOf(n) === today)
        .map((n) => {
          // Coordinates are stored as [lat, lng] (ArrayField of floats).
          const c = n.coordinates ?? null;
          return {
            uuid: String(n.uuid),
            name: n.name ?? "",
            retailer: n.request?.retailer?.name ?? "",
            address: n.address ?? "",
            date: today,
            startTime: n.startTime ?? null,
            endTime: n.endTime ?? null,
            coords:
              c && c.length >= 2
                ? { lat: c[0] as number, lng: c[1] as number }
                : null,
          };
        })
    );
  }, [todaysEvents, today]);

  // Re-read the board and phone locations every minute. The refresh runs as
  // a transition so the page (and the map's camera) stays put while it loads
  // instead of dropping back to the skeleton. Must be useEffect so the
  // interval cleans up on unmount.
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      startTransition(() => {
        setTick((t) => t + 1);
        setNow(new Date());
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const pingData = useLazyLoadQuery<RecentLocationPingsQueryType>(
    RecentLocationPingsQuery,
    // 120 min: walk-up may only ping at clock-in + while the check-in
    // tab stays open; 30 min dropped anyone who clocked early and put
    // the phone away.
    { withinMinutes: 120, tenantId: tenantId || null },
    { fetchPolicy: "network-only", fetchKey: tick },
  );
  const shiftData = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId: tenantId || null },
    { fetchPolicy: "store-and-network", fetchKey: tick },
  );

  const board: BoardRow[] = useMemo(() => {
    return (shiftData?.liveShiftBoard ?? [])
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        eventUuid: String(row.eventUuid),
        eventName: row.eventName ?? "",
        brandName: row.brandName ?? "",
        store: row.store ?? "",
        address: row.address ?? "",
        date: row.date ?? null,
        localDate: row.localDate ?? null,
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        startLocal: row.startLocal ?? null,
        endLocal: row.endLocal ?? null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        locationSource: row.locationSource ?? null,
        assigned: (row.assigned ?? [])
          .filter((ba): ba is NonNullable<typeof ba> => Boolean(ba))
          .map((ba) => ({
            ambassadorUuid: String(ba.ambassadorUuid),
            name: ba.name ?? "",
            status: ba.status ?? "",
            clockInAt: ba.clockInAt ?? null,
            clockOutAt: ba.clockOutAt ?? null,
            lat: ba.lat ?? null,
            lng: ba.lng ?? null,
            locationAt: ba.locationAt ?? null,
          })),
      }));
  }, [shiftData]);

  const events = useMemo(
    () => buildTodayEvents({ listed, board, now, today }),
    [listed, board, now, today],
  );
  const pins = useMemo(() => eventPins(events), [events]);

  // Brand users never get ambassador phone locations: the markers are an
  // Ignite-ops tool. Their names come through `useBaLabel` ("First L.").
  const bas = useMemo(() => {
    if (isClient) return [];
    const pings: PingRow[] = (pingData?.recentLocationPings ?? []).map((p) => ({
      ambassadorUuid: String(p.ambassadorUuid),
      eventUuid: String(p.eventUuid),
      lat: p.lat,
      lng: p.lng,
      recordedAt: p.recordedAt,
    }));
    return baMarkers(events, pings, now);
  }, [isClient, pingData, events, now]);

  const counts = useMemo(() => todayCounts(events, now), [events, now]);
  const coverage = useMemo(() => mapCoverage(events, bas.length), [events, bas]);
  const scope = `${tenantId ?? "all"}|${today}`;
  const pinSet = useMemo(() => pinSetKey(scope, pins, bas), [scope, pins, bas]);

  const clockSummary = useMemo(() => {
    let clockedOut = 0;
    let noShows = 0;
    for (const e of events) {
      for (const ba of e.assigned) {
        if (ba.status === "clocked_out") clockedOut += 1;
        else if (ba.status === "no_show" || ba.status === "missed") noShows += 1;
      }
    }
    return { clockedOut, noShows };
  }, [events]);

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ uuid: string; n: number } | null>(null);
  const rowEls = useRef(new Map<string, HTMLLIElement>());

  // List → map: pan to the pin and open its card.
  const showOnMap = useCallback((uuid: string) => {
    setSelectedUuid(uuid);
    setFocus((f) => ({ uuid, n: (f?.n ?? 0) + 1 }));
  }, []);
  // Map → list: highlight the row and bring it into view.
  const selectFromMap = useCallback((uuid: string) => {
    setSelectedUuid(uuid);
    rowEls.current.get(uuid)?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);
  const closeCard = useCallback(() => setSelectedUuid(null), []);
  const openEvent = useCallback(
    (uuid: string) => navigate(`/event/view/${uuid}`),
    [navigate],
  );

  const tiles = todayShowsGroundTiles(counts) ? (
    <div className="spark-bento" aria-label="Today on the ground">
      {todayGroundKpis(counts).map((k) => (
        <SparkBentoTile key={k.label} {...k} />
      ))}
    </div>
  ) : null;

  if (coverage.layout === "empty") {
    return (
      <div className="space-y-4">
        {tiles}
        <p
          className="spark-card px-4 py-3 text-sm"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          No events on the books today.{" "}
          <Link
            to="/upcoming"
            className="underline"
            style={{ color: "var(--spark-text)" }}
          >
            See upcoming events
          </Link>
        </p>
        {!isClient ? (
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <TodayQueueLine />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </div>
    );
  }

  const showMap = coverage.layout === "map";

  return (
    <div className="space-y-4">
      {tiles}
      {!showMap && coverage.note ? (
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          {coverage.note}
        </p>
      ) : null}
      <div
        className={
          showMap
            ? "grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]"
            : "grid gap-5 grid-cols-1"
        }
      >
        {showMap ? (
          <div className="spark-card overflow-hidden order-1 flex flex-col h-[460px] lg:h-[640px]">
            <div className="relative flex-1 min-h-0">
              <TodayMapView
                apiKey={apiKey}
                pins={pins}
                bas={bas}
                fitKey={pinSet}
                scope={scope}
                selectedUuid={selectedUuid}
                focus={focus}
                nameOf={nameOf}
                onSelectPin={selectFromMap}
                onCloseCard={closeCard}
                onOpenEvent={openEvent}
              />
            </div>
            <div
              className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5"
              style={{ borderTop: "1px solid var(--spark-border)" }}
            >
              <MapLegend showPhones={bas.length > 0} />
              {coverage.note ? (
                <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                  {coverage.note}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Roster rail */}
        <div
          className={`spark-card overflow-hidden flex flex-col order-2 ${
            showMap ? "min-h-[280px] max-h-[460px] lg:max-h-[640px]" : ""
          }`}
        >
          <div
            className="p-4 flex items-start justify-between gap-3"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <div className="min-w-0">
              <h3 className="font-bold">
                Today
                <span
                  className="text-xs font-normal ml-2"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {events.length} {plural(events.length, "event", "events")}
                </span>
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
                {counts.onClock} clocked in · {clockSummary.clockedOut} clocked out ·{" "}
                <span
                  style={{
                    color:
                      clockSummary.noShows > 0 ? "var(--spark-orange)" : undefined,
                  }}
                >
                  {clockSummary.noShows} {plural(clockSummary.noShows, "no-show", "no-shows")}
                </span>
              </p>
            </div>
            {!isClient ? (
              <Link
                to="/live-board"
                className="text-xs underline shrink-0"
                style={{ color: "var(--spark-text)" }}
              >
                On the clock
              </Link>
            ) : null}
          </div>
          <ul className="overflow-y-auto flex-1">
            {events.map((e) => (
              <EventRow
                key={e.uuid}
                event={e}
                selected={e.uuid === selectedUuid}
                people={peopleLines(e, nameOf)}
                onShowOnMap={showOnMap}
                rowRef={(el) => {
                  if (el) rowEls.current.set(e.uuid, el);
                  else rowEls.current.delete(e.uuid);
                }}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default function SparkToday() {
  const { isClient } = useSparkRole();
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <Layout>
      <div className="space-y-5 max-w-7xl spark-fade-in spark-scale">
        <SparkHubTabs tabs={SCHEDULE_HUB_TABS} ariaLabel="Schedule views" />
        <SparkPageHeader
          title={isClient ? "Today's activations" : "Today, on the ground"}
          infoTip={
            isClient
              ? "Live schedule and check-in status across today's activations."
              : "Live bookings and check-ins for today. Punch edits live under On the clock."
          }
        />

        <Suspense fallback={<DashboardSkeleton />}>
          <Inner apiKey={apiKey} />
        </Suspense>
      </div>
    </Layout>
  );
}
