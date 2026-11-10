import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { ReportsFieldPhotosQuery } from "@/api/queries/ReportsFieldPhotosQuery";
import type { ReportsFieldPhotosQuery as ReportsFieldPhotosQueryType } from "@api/queries/__generated__/ReportsFieldPhotosQuery.graphql";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { thumbUrl } from "@/utils/thumb";

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

/**
 * "Your program, last 30 days" — the first thing a brand user sees on Home:
 * three headline numbers and the most recent photos from the field, with one
 * click through to every recap and the full program report. Answers "what
 * happened?" before "what's scheduled?".
 */
export const ClientProgramSnapshot: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    return { startDate: ymd(start), endDate: ymd(end) };
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
        .filter((n): n is NonNullable<typeof n> => Boolean(n?.heroImageUrl))
        .slice(0, 6)
        .map((n) => ({
          uuid: String(n.uuid),
          url: thumbUrl(String(n.heroImageUrl), 800),
          label: [n.eventRetailer, n.eventState].filter(Boolean).join(", "),
        })),
    [photoData],
  );

  const hasActivity = (m.totalEvents ?? 0) > 0 || photos.length > 0;
  if (!hasActivity) return null;

  const tiles: { label: string; value: string }[] = [
    { label: "Events", value: fmtNum(m.totalEvents) },
    { label: "Consumers sampled", value: fmtNum(m.consumersSampled) },
    {
      label: "Said they'd buy",
      value:
        typeof m.purchaseIntent === "number" ? `${m.purchaseIntent.toFixed(0)}%` : "—",
    },
  ];

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Your program in the last 30 days">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            Last 30 days
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold" style={{ letterSpacing: "-0.02em" }}>
            Your program at a glance
          </h2>
        </div>
        <Link
          to="/reports"
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
        >
          Open program report
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-5">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <p
              className="tab-num font-bold truncate"
              style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.75rem)", lineHeight: 1.05 }}
            >
              {t.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--spark-text-secondary)" }}>
              {t.label}
            </p>
          </div>
        ))}
      </div>

      {photos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-6">
            {photos.map((p) => (
              <Link
                key={p.uuid}
                to={`/recap/view-custom/${p.uuid}`}
                className="group relative block overflow-hidden rounded-xl"
                style={{ aspectRatio: "4 / 3", background: "rgba(255,255,255,0.04)" }}
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
