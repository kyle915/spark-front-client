import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ShelfSummaryQuery } from "@/api/queries/ShelfSummaryQuery";
import type { ShelfSummaryQuery as ShelfSummaryQueryType } from "@api/queries/__generated__/ShelfSummaryQuery.graphql";
import {
  notFoundHeading,
  shelfFigures,
  shelfNotes,
  shelfVisitDay,
} from "@/lib/shelfSummary";

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

const TITLE = "On shelf";

type Window = { tenantId: string; startDate: string; endDate: string };

const Inner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<ShelfSummaryQueryType>(
    ShelfSummaryQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const summary = data.shelfSummary;
  const figures = shelfFigures(summary);
  const notes = shelfNotes(summary);

  // A brand with no shelf photos in these dates gets no empty card.
  if (summary.status === "unavailable") return null;
  if (figures.length === 0 && notes.length === 0) return null;

  return (
    <section aria-label={TITLE} className="spark-card p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
          {TITLE}
        </h3>
        <p className="text-xs" style={META}>
          Read from shelf photos on approved retail recaps. Where staff corrected a reading,
          the correction is used.
        </p>
      </div>

      {figures.length > 0 ? (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 m-0">
          {figures.map((figure) => (
            <div key={figure.key} className="min-w-0">
              <dt className="text-[13px] font-medium" style={SECONDARY}>
                {figure.label}
              </dt>
              <dd className="m-0">
                <span className="display text-2xl font-bold tabular-nums" style={TEXT}>
                  {figure.share}
                </span>
                <span className="block text-[13px] mt-0.5" style={META}>
                  {figure.basis}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {summary.notFound > 0 ? (
        <div className="min-w-0">
          <h4 className="text-[13px] font-medium mb-1.5" style={SECONDARY}>
            {notFoundHeading(summary.notFound)}
          </h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {summary.notFoundStores.map((store, i) => (
              <li
                key={`${store.storeName}|${store.eventDate}|${i}`}
                className="text-sm flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 break-words" style={TEXT}>
                  {store.storeName}
                </span>
                <span className="text-[13px] shrink-0 tabular-nums" style={META}>
                  {shelfVisitDay(store.eventDate)}
                </span>
              </li>
            ))}
          </ul>
          {summary.notFoundMore > 0 ? (
            <p className="text-[13px] mt-1.5" style={META}>
              And {summary.notFoundMore.toLocaleString("en-US")} more.
            </p>
          ) : null}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="flex flex-col gap-1">
          {notes.map((note) => (
            <p key={note} className="text-[13px]" style={META}>
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
};

/**
 * Whether the product was on the shelf at retail visits, from shelf photos
 * on approved recaps: two shares, each with its base, and the stores where
 * it was not found. Renders nothing when there are no shelf photos in the
 * dates, while it loads, or when the load fails; the rest of the page is
 * left alone.
 */
export const OnShelfSummary: React.FC<Window> = (props) => (
  <ErrorBoundary
    key={`${props.tenantId}|${props.startDate}|${props.endDate}`}
    fallback={null}
  >
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  </ErrorBoundary>
);

export default OnShelfSummary;
