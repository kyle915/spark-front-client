import { Suspense, useMemo, type ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantFeedbackThemesQuery } from "@/api/queries/TenantFeedbackThemesQuery";
import type { TenantFeedbackThemesQuery as ThemesQuery } from "@api/queries/__generated__/TenantFeedbackThemesQuery.graphql";
import { TenantCompetitorMentionsQuery } from "@/api/queries/TenantCompetitorMentionsQuery";
import type { TenantCompetitorMentionsQuery as MentionsQuery } from "@api/queries/__generated__/TenantCompetitorMentionsQuery.graphql";
import { ShelfSummaryQuery } from "@/api/queries/ShelfSummaryQuery";
import type { ShelfSummaryQuery as ShelfQuery } from "@api/queries/__generated__/ShelfSummaryQuery.graphql";
import { ReportsBestPhotosQuery } from "@/api/queries/ReportsBestPhotosQuery";
import type { ReportsBestPhotosQuery as PhotosQuery } from "@api/queries/__generated__/ReportsBestPhotosQuery.graphql";
import { recapsLabel } from "@/lib/feedbackThemes";
import { leadThemes } from "@/lib/reportEvidence";
import { topBrands } from "@/lib/commentInsights";
import { shelfFigures } from "@/lib/shelfSummary";
import { directThumbUrl, handleThumbError } from "@/utils/thumb";

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

type Window = { tenantId: string; startDate: string; endDate: string };

const Jump: React.FC<{ href: string; children: string }> = ({ href, children }) => (
  <a href={href} className="text-xs underline underline-offset-2" style={META}>
    {children}
  </a>
);

/**
 * Themes, the top competitor, shelf, and the best field photos already
 * computed for this range. No new model call: each block reads the same
 * query the sections further down the report use.
 */
const VoiceCard: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const themesData = useLazyLoadQuery<ThemesQuery>(
    TenantFeedbackThemesQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const mentionsData = useLazyLoadQuery<MentionsQuery>(
    TenantCompetitorMentionsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const shelfData = useLazyLoadQuery<ShelfQuery>(
    ShelfSummaryQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );

  const themes = themesData.tenantFeedbackThemes;
  const leads = useMemo(
    () => (themes.status === "ready" ? leadThemes(themes.themes) : []),
    [themes],
  );
  const competitor = useMemo(() => {
    const result = mentionsData.tenantCompetitorMentions;
    if (result.status !== "ready") return null;
    return topBrands(result.brands, 1)[0] ?? null;
  }, [mentionsData]);
  const shelf = useMemo(() => {
    const summary = shelfData.shelfSummary;
    if (summary.status === "unavailable") return null;
    return shelfFigures(summary)[0] ?? null;
  }, [shelfData]);

  if (leads.length === 0 && !competitor && !shelf) return null;

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="What the field showed">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
          What the field showed
        </h2>
        {leads.length > 0 ? <Jump href="#report-themes">All themes</Jump> : null}
      </div>
      {leads.length > 0 ? (
        <ul className="m-0 mt-3 p-0 list-none flex flex-col gap-2">
          {leads.map((theme) => (
            <li key={`${theme.section}|${theme.label}`} className="text-sm" style={TEXT}>
              <span className="font-medium">{theme.label}</span>
              <span style={META}>
                {" · "}
                {recapsLabel(theme.recapCount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {competitor ? (
        <p className="text-sm mt-3 m-0" style={SECONDARY}>
          People also mentioned {competitor.brand}
          <span style={META}>
            {" · "}
            {recapsLabel(competitor.recapCount)}
          </span>
          {" · "}
          <Jump href="#report-competitors">Other brands</Jump>
        </p>
      ) : null}
      {shelf ? (
        <p className="text-sm mt-2 m-0" style={SECONDARY}>
          {shelf.label}: {shelf.share}
          <span style={META}> · {shelf.basis}</span>
          {" · "}
          <Jump href="#report-shelf">On shelf</Jump>
        </p>
      ) : null}
    </section>
  );
};

const ShotsCard: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<PhotosQuery>(
    ReportsBestPhotosQuery,
    { tenantId, startDate, endDate, first: 24 },
    { fetchPolicy: "store-or-network" },
  );
  const photos = (data.tenantPhotoGallery?.photos ?? []).slice(0, 4);
  if (photos.length === 0) return null;

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Best field shots">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
          Best field shots
        </h2>
        <Jump href="#report-photos">All photos</Jump>
      </div>
      <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-4 gap-2">
        {photos.map((photo) => (
          <li key={photo.id} className="min-w-0">
            <img
              src={directThumbUrl(photo.url, 400) || photo.url}
              onError={(e) => handleThumbError(e.currentTarget, photo.url, 400)}
              alt={photo.caption || photo.store || "Field photo"}
              className="w-full aspect-square object-cover rounded-lg"
              style={{ border: "1px solid var(--spark-border)" }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

const Guard: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={null}>
    <Suspense fallback={null}>{children}</Suspense>
  </ErrorBoundary>
);

/** Voice and best shots above the charts. Each card hides itself when empty. */
const ReportEvidenceStrip: React.FC<Window> = (props) => (
  <>
    <Guard>
      <VoiceCard {...props} />
    </Guard>
    <Guard>
      <ShotsCard {...props} />
    </Guard>
  </>
);

export default ReportEvidenceStrip;
