import WhatChangedLine from "@/components/explain/WhatChangedLine";
import { useMemo } from "react";
import { Link } from "react-router";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import useSparkRole from "@/hooks/useSparkRole";
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

  // In Client view, staff are counted the way the brand is (approved recaps
  // only), so this headline matches the weekly chart under it.
  const { isClient } = useSparkRole();
  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate,
      endDate,
      ...(isClient ? { clientView: true } : {}),
    }),
    [startDate, endDate, isClient],
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
      ...(isClient ? { clientView: true } : {}),
    }),
    [priorStart, priorEnd, isClient],
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

  // "62% of 1,240 asked": the rate is out of the consumers whose recap form
  // asked the question, which can be fewer than everyone sampled.
  const intent = ofAsked(m.purchaseIntent, m.purchaseIntentBase);

  const hasActivity = (m.totalEvents ?? 0) > 0 || (m.consumersSampled ?? 0) > 0;
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
          Last 30 days
        </h2>
        <Link
          to="/reports"
          className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold no-underline transition hover:opacity-90"
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
    </section>
  );
};

export default ClientProgramSnapshot;
