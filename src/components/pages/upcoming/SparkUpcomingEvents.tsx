import { Link } from "react-router";
import { Suspense, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { SCHEDULE_HUB_TABS } from "@/shared/sparkHubNav";
import { useAllEventPages } from "@/hooks/useAllEventPages";
import { useAllConnectionPages } from "@/hooks/useAllConnectionPages";
import { addDaysIso, opsTodayIso, venueDayOf } from "@/utils/venueDay";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import ChangeEventDateDialog from "@/events/ChangeEventDateDialog";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import useSparkRole from "@/hooks/useSparkRole";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import UpcomingList, { UpcomingSkeleton, type UpcomingRow } from "./UpcomingList";
import {
  filterUpcomingRows,
  rowNeedsAttention,
  UPCOMING_HORIZONS,
  type UpcomingAttentionFilter,
  type UpcomingHorizonDays,
} from "./upcomingFilters";

type UpcomingRequestRow = NonNullable<
  NonNullable<RequestsQueryType["response"]["requests"]["edges"][number]>["node"]
>;

function locationOf(
  name: string,
  retailer: string | null | undefined,
  address: string | null | undefined,
): string {
  const same = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts: string[] = [];
  const r = (retailer ?? "").trim();
  const a = (address ?? "").trim();
  if (r && !same(r, name)) parts.push(r);
  if (a && !same(a, name) && !(r && same(a, r))) parts.push(a);
  return parts.join(" · ");
}

function UpcomingHeader({
  horizonDays,
  count,
}: {
  horizonDays: UpcomingHorizonDays;
  count?: number;
}) {
  return (
    <SparkPageHeader
      eyebrow="Schedule · Upcoming shifts"
      title="Upcoming"
      support={
        count === undefined
          ? `Next ${horizonDays} days`
          : `Next ${horizonDays} days · ${count} ${count === 1 ? "event" : "events"}`
      }
      action={<LinkedSheetChip />}
    />
  );
}

const Inner: React.FC<{
  isClient: boolean;
  horizonDays: UpcomingHorizonDays;
  onHorizonChange: (days: UpcomingHorizonDays) => void;
}> = ({ isClient, horizonDays, onHorizonChange }) => {
  const { tenantId } = useAuthStore();
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rescheduleRow, setRescheduleRow] = useState<UpcomingRow | null>(null);
  const [attentionFilter, setAttentionFilter] =
    useState<UpcomingAttentionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const today = useMemo(() => opsTodayIso(), []);
  const end = useMemo(
    () => addDaysIso(today, horizonDays),
    [today, horizonDays],
  );

  const { events, loadingMore: loadingMoreEvents } = useAllEventPages(
    {
      ...(tenantId ? { tenantId } : {}),
      startDate: addDaysIso(today, -1),
      endDate: addDaysIso(end, 1),
    },
    { fetchKey: refreshKey },
  );

  const { nodes: requests, loadingMore: loadingMoreRequests } =
    useAllConnectionPages<RequestsQueryType, UpcomingRequestRow>(
      RequestsQuery,
      {
        first: 500,
        filters: {
          ...(tenantId ? { tenantId } : {}),
          startDate: addDaysIso(today, -1),
          endDate: addDaysIso(end, 1),
        },
      },
      (response) => response.requests,
    );
  const loadingMore = loadingMoreEvents || loadingMoreRequests;

  const rows: UpcomingRow[] = useMemo(() => {
    const out: UpcomingRow[] = [];

    for (const n of events) {
      const day = venueDayOf(n);
      if (!day || day < today || day > end) continue;
      const name = n.name ?? "Untitled";
      out.push({
        uuid: String(n.uuid),
        name,
        date: day,
        sortAt: n.startTime ?? n.date ?? "",
        startRaw: n.startTime ?? null,
        endRaw: n.endTime ?? null,
        location: locationOf(name, n.request?.retailer?.name, n.address),
        address: n.address ?? null,
        status: n.status?.name ?? "",
        statusSlug: (n.status?.slug ?? n.status?.name ?? "")
          .toString()
          .toLowerCase(),
        source: "event",
        hasAddress: Boolean((n.address ?? "").trim()),
        timezoneLabel: n.timezone?.code ?? n.timezone?.name ?? null,
      });
    }

    const seenEventUuids = new Set(out.map((r) => r.uuid));
    for (const r of requests) {
      const day = venueDayOf(r);
      if (!day || day < today || day > end) continue;
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      if (r.event?.uuid && seenEventUuids.has(String(r.event.uuid))) continue;
      if (slug === "done" || slug === "completed" || slug === "declined") continue;
      const name = r.retailer?.name ?? r.name ?? "Untitled";
      out.push({
        uuid: String(r.uuid),
        name,
        date: day,
        sortAt: r.startTime ?? r.date ?? "",
        startRaw: r.startTime ?? null,
        endRaw: r.endTime ?? null,
        location: locationOf(name, null, r.address),
        address: r.address ?? null,
        status: r.status?.name ?? "Pending",
        statusSlug: slug || "pending",
        source: "request",
        hasAddress: Boolean((r.address ?? "").trim()),
      });
    }

    return out.sort(
      (a, b) => a.date.localeCompare(b.date) || a.sortAt.localeCompare(b.sortAt),
    );
  }, [events, requests, today, end]);

  const attentionCount = useMemo(
    () => rows.filter(rowNeedsAttention).length,
    [rows],
  );
  const visibleRows = useMemo(
    () => filterUpcomingRows(rows, attentionFilter, searchQuery),
    [rows, attentionFilter, searchQuery],
  );

  return (
    <>
      <UpcomingHeader horizonDays={horizonDays} count={visibleRows.length} />

      <div className="spark-card p-3 flex flex-wrap items-center gap-2.5">
        <div className="pill-group" role="group" aria-label="Upcoming window">
          {UPCOMING_HORIZONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => onHorizonChange(opt.days)}
              className={`pill-btn ${horizonDays === opt.days ? "on" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="pill-group" role="group" aria-label="Attention filter">
          <button
            type="button"
            onClick={() => setAttentionFilter("all")}
            className={`pill-btn ${attentionFilter === "all" ? "on" : ""}`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setAttentionFilter("attention")}
            className={`pill-btn ${attentionFilter === "attention" ? "on" : ""}`}
          >
            Needs attention ({attentionCount})
          </button>
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search venue or address…"
          aria-label="Filter upcoming shifts"
          className="ml-auto rounded-lg px-3 py-1.5 text-xs flex-1 sm:flex-none min-w-[200px]"
          style={{
            background: "var(--spark-field-bg, var(--spark-surface))",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        />
      </div>

      {rows.length === 0 ? (
        <SparkEmptyState
          title={`Nothing scheduled in the next ${horizonDays} days`}
          body={
            isClient
              ? "Your requests show here once they're approved or waiting for approval."
              : "Approved events and pending requests show here."
          }
          action={
            <>
              <Link to="/requests/create" className="spark-btn-primary">
                Create a request
              </Link>
              <Link to="/requests/list" className="spark-btn-ghost">
                Open the tracker
              </Link>
            </>
          }
        />
      ) : visibleRows.length === 0 ? (
        <div
          className="spark-card p-6 text-center text-sm"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No upcoming shifts match your filter.{" "}
          <button
            type="button"
            onClick={() => {
              setAttentionFilter("all");
              setSearchQuery("");
            }}
            className="underline font-semibold cursor-pointer"
            style={{ color: "var(--spark-text)" }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <UpcomingList
            rows={visibleRows}
            today={today}
            onReschedule={(row) => setRescheduleRow(row)}
            onPeekStore={(row) =>
              openStoreSheet({
                requestId: row.source === "request" ? row.uuid : undefined,
                storeName: row.name,
                address: row.address ?? null,
                fallbackTitle: row.name,
              })
            }
          />
          {loadingMore ? (
            <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              Loading more events…
            </p>
          ) : null}
          {rescheduleRow ? (
            <ChangeEventDateDialog
              open
              onClose={() => setRescheduleRow(null)}
              eventUuid={rescheduleRow.uuid}
              date={rescheduleRow.date}
              startTime={rescheduleRow.startRaw}
              endTime={rescheduleRow.endRaw}
              storeName={rescheduleRow.name}
              timezoneLabel={rescheduleRow.timezoneLabel}
              onChanged={() => {
                setRescheduleRow(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
};

export default function SparkUpcomingEvents() {
  const { isClient } = useSparkRole();
  const [horizonDays, setHorizonDays] = useState<UpcomingHorizonDays>(7);

  return (
    <Layout>
      <div className="space-y-5 max-w-7xl spark-scale">
        <SparkHubTabs tabs={SCHEDULE_HUB_TABS} ariaLabel="Schedule views" />
        <Suspense
          fallback={
            <>
              <UpcomingHeader horizonDays={horizonDays} />
              <UpcomingSkeleton />
            </>
          }
        >
          <Inner
            isClient={isClient}
            horizonDays={horizonDays}
            onHorizonChange={setHorizonDays}
          />
        </Suspense>
      </div>
    </Layout>
  );
}
