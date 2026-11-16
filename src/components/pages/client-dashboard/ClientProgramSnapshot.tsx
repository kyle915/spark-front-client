import { pickFieldPhoto } from "@/utils/fieldPhoto";
import WhatChangedLine from "@/components/explain/WhatChangedLine";
import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { ReportsFieldPhotosQuery } from "@/api/queries/ReportsFieldPhotosQuery";
import type { ReportsFieldPhotosQuery as ReportsFieldPhotosQueryType } from "@api/queries/__generated__/ReportsFieldPhotosQuery.graphql";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { thumbUrl } from "@/utils/thumb";
import { periodChange } from "./periodChange";
import { ofAsked } from "@/lib/consumerBreakdown";

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

const DAYS = 30;

/**
 * "Your program, last 30 days" — the first thing a brand user sees on Home:
 * three headline numbers and the most recent photos from the field, with one
 * click through to every recap and the full program report. Answers "what
 * happened?" before "what's scheduled?".
 */
export const ClientProgramSnapshot: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { startDate, endDate, priorStart, priorEnd } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - DAYS);
    // The window before it: the same length, ending the day before `start`.
    const beforeEnd = new Date(start);
    beforeEnd.setDate(start.getDate() - 1);
    const beforeStart = new Date(beforeEnd);
    beforeStart.setDate(beforeEnd.getDate() - DAYS);
    return {
      startDate: ymd(start),
      endDate: ymd(end),
      priorStart: ymd(beforeStart),
      priorEnd: ymd(beforeEnd),
    };
  }, []);

  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate,
      endDate,
    }),
    [startDate, endDate],
  );
  const { dashboard } = useEventDashboardData(tenantId, filters, 0);
  const m = dashboard.metrics;

  const priorFilters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: priorStart,
      endDate: priorEnd,
    }),
    [priorStart, priorEnd],
  );
  const prior = useEventDashboardData(tenantId, priorFilters, 0).dashboard.metrics;
  const against = (
    current: number | null | undefined,
    previous: number | null | undefined,
    format: (n: number) => string,
  ) =>
    periodChange({
      current,
      previous,
      previousEvents: prior.totalEvents,
      format,
      days: DAYS,
    });

  const photoData = useLazyLoadQuery<ReportsFieldPhotosQueryType>(
    ReportsFieldPhotosQuery,
    {
      first: 30,
      filters: { tenantId, startDate, endDate, approved: true },
    },
    { fetchPolicy: "store-or-network" },
  );
  const photos = useMemo(
    () =>
      (photoData?.customRecaps?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({ n, src: pickFieldPhoto(n.customRecapFiles) }))
        // Never a receipt or product-spend photo; such recaps are skipped.
        .filter((x): x is { n: typeof x.n; src: string } => Boolean(x.src))
        .map(({ n, src }) => ({
          uuid: String(n.uuid),
          url: thumbUrl(src, 800) || src,
          label: [n.eventRetailer, n.eventState].filter(Boolean).join(", "),
        }))
        .reduce<{ uuid: string; url: string; label: string }[][]>(
          // Two ambassadors at one booth file near-identical photos. Show
          // one photo per place first; repeats only fill leftover slots.
          ([fresh, repeats], photo) => {
            const seen = fresh.some((p) => p.label && p.label === photo.label);
            return seen ? [fresh, [...repeats, photo]] : [[...fresh, photo], repeats];
          },
          [[], []],
        )
        .flat()
        .slice(0, 6),
    [photoData],
  );

  // "62% of 1,240 asked": the rate is out of the consumers whose recap form
  // asked the question, which can be fewer than everyone sampled.
  const intent = ofAsked(m.purchaseIntent, m.purchaseIntentBase);

  const hasActivity = (m.totalEvents ?? 0) > 0 || photos.length > 0;
  if (!hasActivity) return null;

  // Each figure reads as the end of the heading's sentence: "Your program
  // in the last 30 days — 1,445 consumers sampled".
  const tiles: { key: string; value: string; says: string; change: string | null }[] = [
    {
      key: "events",
      value: fmtNum(m.totalEvents),
      says: m.totalEvents === 1 ? "event run" : "events run",
      change: against(m.totalEvents, prior.totalEvents, fmtNum),
    },
    {
      key: "sampled",
      value: fmtNum(m.consumersSampled),
      says: m.consumersSampled === 1 ? "consumer sampled" : "consumers sampled",
      change: against(m.consumersSampled, prior.consumersSampled, fmtNum),
    },
    {
      key: "intent",
      value: intent ? intent.rate : "—",
      says: intent?.asked ? `${intent.asked} said they'd buy` : "said they'd buy",
      change: against(m.purchaseIntent, prior.purchaseIntent, fmtPct),
    },
  ];

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Your program in the last 30 days">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-semibold" style={{ letterSpacing: "-0.02em" }}>
          Your program in the last 30 days
        </h2>
        <Link
          to="/reports"
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
        >
          Open program report
        </Link>
      </div>

      <dl className="spark-says mt-5">
        {tiles.map((t) => (
          <div key={t.key} className="spark-says-item">
            <dt className="spark-says-words">
              {t.says}
              {t.change ? <span className="spark-says-change">{t.change}</span> : null}
            </dt>
            <dd className="spark-says-figure tab-num">{t.value}</dd>
          </div>
        ))}
      </dl>

      <WhatChangedLine
        tenantId={tenantId}
        startDate={startDate}
        endDate={endDate}
        className="mt-4"
      />

      {photos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-6">
            {photos.map((p) => (
              <Link
                key={p.uuid}
                to={`/recap/view-custom/${p.uuid}`}
                className="group relative block overflow-hidden rounded-xl"
                style={{ aspectRatio: "4 / 3", background: "rgba(var(--spark-ink-rgb),0.04)" }}
                title={p.label ? `Open the recap from ${p.label}` : "Open this recap"}
              >
                <img
                  src={p.url}
                  alt={p.label ? `Photo from ${p.label}` : "Photo from the field"}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {p.label ? (
                  <span
                    className="absolute left-0 right-0 bottom-0 px-2.5 py-1.5 text-xs font-medium truncate"
                    style={{
                      color: "#fff",
                      background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.72))",
                    }}
                  >
                    {p.label}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/recaps/list" className="text-sm underline">
              See every recap
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default ClientProgramSnapshot;
