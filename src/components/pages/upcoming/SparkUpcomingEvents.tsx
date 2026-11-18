import { Link } from "react-router";
import { Suspense, useMemo } from "react";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { useAllEventPages } from "@/hooks/useAllEventPages";
import { useAllConnectionPages } from "@/hooks/useAllConnectionPages";
import { addDaysIso, opsTodayIso, venueDayOf } from "@/utils/venueDay";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";

import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import UpcomingList, { UpcomingSkeleton, type UpcomingRow } from "./UpcomingList";

type UpcomingRequestRow = NonNullable<
  NonNullable<RequestsQueryType["response"]["requests"]["edges"][number]>["node"]
>;

/**
 * "Upcoming" — next 7 days, grouped by day. Combines two sources:
 *  - Approved/scheduled events from EventsQuery (event row already exists)
 *  - Pending/queue/approved requests from RequestsQuery (no event row yet)
 * so admins see what's locked in AND what's still working through approval.
 */

/** "Retailer · address", dropping a part that only repeats the row's name. */
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

function UpcomingHeader({ count }: { count?: number }) {
  return (
    <SparkPageHeader
      title="Upcoming"
      support={
        count === undefined
          ? "Next 7 days"
          : `Next 7 days · ${count} ${count === 1 ? "event" : "events"}`
      }
      action={<LinkedSheetChip />}
    />
  );
}

const Inner: React.FC<{ isClient: boolean }> = ({ isClient }) => {
  const { tenantId } = useAuthStore();
  // Days are the venue's, compared as YYYY-MM-DD strings; "today" is the
  // ops day (Pacific), as on the live board. Nothing goes through the
  // viewer's browser clock.
  const today = useMemo(() => opsTodayIso(), []);
  const end = useMemo(() => addDaysIso(today, 7), [today]);

  // The API filters by UTC day, so ask for a day either side of the window
  // and keep rows whose venue day falls inside it. Every page is loaded: the
  // list returns at most 100 a request.
  const { events, loadingMore: loadingMoreEvents } = useAllEventPages({
    ...(tenantId ? { tenantId } : {}),
    startDate: addDaysIso(today, -1),
    endDate: addDaysIso(end, 1),
  });

  // Brand users get 200 rows a request; walk the rest by cursor.
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

    // 1. Scheduled / approved events with a real event row.
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
        status: n.status?.name ?? "",
        statusSlug: (n.status?.slug ?? n.status?.name ?? "")
          .toString()
          .toLowerCase(),
        source: "event",
      });
    }

    // 2. Pending/queue/approved requests in the same window that haven't
    //    been promoted to events yet. Avoid duplicates by checking the
    //    event.uuid set we already added.
    const seenEventUuids = new Set(out.map((r) => r.uuid));
    for (const r of requests) {
      // Request times are venue wall-clock strings: read the day off them.
      const day = venueDayOf(r);
      if (!day || day < today || day > end) continue;
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      // Skip rows already covered by events query and skip done/declined.
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
        status: r.status?.name ?? "Pending",
        statusSlug: slug || "pending",
        source: "request",
      });
    }

    return out.sort(
      (a, b) => a.date.localeCompare(b.date) || a.sortAt.localeCompare(b.sortAt),
    );
  }, [events, requests, today, end]);

  return (
    <>
      <UpcomingHeader count={rows.length} />
      {rows.length === 0 ? (
        <SparkEmptyState
          title="Nothing scheduled in the next 7 days"
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
      ) : (
        <>
          <UpcomingList rows={rows} today={today} />
          {loadingMore ? (
            <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              Loading more events…
            </p>
          ) : null}
        </>
      )}
    </>
  );
};

export default function SparkUpcomingEvents() {
  const { isClient } = useSparkRole();
  return (
    <Layout>
      <div className="space-y-6 max-w-5xl spark-scale">
        <Suspense
          fallback={
            <>
              <UpcomingHeader />
              <UpcomingSkeleton />
            </>
          }
        >
          <Inner isClient={isClient} />
        </Suspense>
      </div>
    </Layout>
  );
}
