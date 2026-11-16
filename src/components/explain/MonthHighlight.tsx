import { Suspense, type CSSProperties } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { MonthHighlightQuery } from "@/api/queries/MonthHighlightQuery";
import type { MonthHighlightQuery as MonthHighlightQueryType } from "@api/queries/__generated__/MonthHighlightQuery.graphql";
import { monthKey, previousMonth, recapHref, storeHref } from "@/lib/storeProfile";

const META: CSSProperties = { color: "var(--spark-text-meta)" };
const SECONDARY: CSSProperties = { color: "var(--spark-text-secondary)" };
const INK: CSSProperties = { color: "var(--spark-text)" };

type Props = {
  tenantId: string;
  /** "YYYY-MM". */
  month: string;
  /** Heading for `month`. Defaults to the month's own name. */
  heading?: string;
  /** Tried when `month` has too little to show. */
  fallbackMonth?: string;
  className?: string;
};

const Inner: React.FC<Props> = ({ tenantId, month, heading, fallbackMonth, className }) => {
  const data = useLazyLoadQuery<MonthHighlightQueryType>(
    MonthHighlightQuery,
    { tenantId, month },
    { fetchPolicy: "store-or-network" },
  );
  const h = data.monthHighlight;
  if (!h) {
    // Too little in this month: the month before, or nothing at all.
    return fallbackMonth ? (
      <Inner tenantId={tenantId} month={fallbackMonth} className={className} />
    ) : null;
  }
  const store = h.store ? storeHref(h.store.storeKey) : null;
  const title = heading ?? h.label;
  return (
    <section aria-label={`Highlight, ${h.label}`} className={className}>
      <h3 className="text-[13px] font-medium mb-2" style={SECONDARY}>
        {title}
      </h3>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {h.photo ? (
          <Link to={recapHref("custom", h.photo.recapUuid)} className="shrink-0 block">
            <img
              src={h.photo.url}
              alt={h.photo.category || "Photo from an approved recap"}
              loading="lazy"
              className="w-full sm:w-40 aspect-[4/3] object-cover rounded-xl"
              style={{ border: "1px solid var(--spark-border)" }}
            />
          </Link>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm leading-relaxed max-w-3xl" style={INK}>
            {h.caption}
          </p>
          {h.quote ? (
            <blockquote className="m-0 mt-3 text-sm leading-relaxed max-w-3xl" style={INK}>
              “{h.quote.text}”
              <footer className="text-xs mt-1" style={META}>
                From{" "}
                {h.quote.recapUuid ? (
                  <Link
                    to={recapHref(h.quote.recapKind, h.quote.recapUuid)}
                    className="underline"
                    style={SECONDARY}
                  >
                    an approved recap
                  </Link>
                ) : (
                  "an approved recap"
                )}
              </footer>
            </blockquote>
          ) : null}
          <p className="text-xs mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {store && h.store ? (
              <Link to={store} className="underline" style={SECONDARY}>
                {h.store.name ? `${h.store.name} store page` : "Store page"}
              </Link>
            ) : null}
            {h.store?.recapUuid ? (
              <Link
                to={recapHref(h.store.recapKind, h.store.recapUuid)}
                className="underline"
                style={SECONDARY}
              >
                Its best recap
              </Link>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
};

/**
 * Highlight of the month: a best store, a comment from a recap and a photo, all
 * picked by rule from approved recaps. Renders nothing while it loads, if
 * it fails, or when the month has too little to show.
 */
const MonthHighlight: React.FC<Props> = (props) => {
  if (!props.tenantId || !props.month) return null;
  return (
    <ErrorBoundary key={`${props.tenantId}|${props.month}`} fallback={null}>
      <Suspense fallback={null}>
        <Inner {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * The current month's highlight under the heading "This month"; early in a
 * month, when it has too little, last month's under its own name.
 */
export const LatestMonthHighlight: React.FC<{ tenantId: string; className?: string }> = ({
  tenantId,
  className,
}) => {
  const month = monthKey(new Date());
  return (
    <MonthHighlight
      tenantId={tenantId}
      month={month}
      heading="This month"
      fallbackMonth={previousMonth(month)}
      className={className}
    />
  );
};

export default MonthHighlight;
