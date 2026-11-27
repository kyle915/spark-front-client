import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { AlertTriangle, Download } from "lucide-react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { BUDGET_PNL_SUBTABS, REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import { EventPnlQuery } from "@/api/queries/EventPnlQuery";
import type { EventPnlQuery as EventPnlQueryType } from "@api/queries/__generated__/EventPnlQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { inputColorScheme } from "@/theme/inputColorScheme";
import { cleanEventName, formatEventDate } from "@/utils/eventLabel";

/**
 * P&L — the cost side of every activation, finally in one place.
 *
 * labor = first clock-in → last clock-out per BA × their booked rate
 * (a booked BA with no clock pair falls back to the event's scheduled
 * duration — those rows say "est."); spend = expense receipts. Rows
 * with BAs missing a booked rate show the gap explicitly so a low
 * number reads as INCOMPLETE, not cheap.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const money = (v: number) =>
  v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// A function so the colour scheme is read at render, not at import.
const inputStyle = (): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(var(--spark-ink-rgb),0.04)",
  border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
  color: "var(--spark-text)",
  colorScheme: inputColorScheme(),
});

const Table: React.FC<{ tenantId: string; start: string; end: string }> = ({
  tenantId,
  start,
  end,
}) => {
  const data = useLazyLoadQuery<EventPnlQueryType>(
    EventPnlQuery,
    { tenantId, startDate: start, endDate: end },
    { fetchPolicy: "network-only" },
  );
  const rows = data.eventPnl ?? [];

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          labor: t.labor + r.laborCost,
          spend: t.spend + r.spend,
          total: t.total + r.totalCost,
          hours: t.hours + r.hours,
          missing: t.missing + r.missingRates,
        }),
        { labor: 0, spend: 0, total: 0, hours: 0, missing: 0 },
      ),
    [rows],
  );

  const exportCsv = () => {
    const lines = [
      [
        "Date",
        "Event",
        "BAs",
        "Hours",
        "Labor",
        "Spend",
        "Total",
        "Estimated",
        "Missing rates",
      ].join(","),
      ...rows.map((r) =>
        [
          r.date ?? "",
          `"${(r.name ?? "").replace(/"/g, '""')}"`,
          r.baCount,
          r.hours,
          r.laborCost.toFixed(2),
          r.spend.toFixed(2),
          r.totalCost.toFixed(2),
          r.estimated ? "yes" : "",
          r.missingRates || "",
        ].join(","),
      ),
      `,TOTAL,,${totals.hours.toFixed(1)},${totals.labor.toFixed(2)},${totals.spend.toFixed(2)},${totals.total.toFixed(2)},,`,
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pnl_${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Labor", value: money(totals.labor) },
          { label: "Spend", value: money(totals.spend) },
          { label: "Total cost", value: money(totals.total) },
          { label: "Hours", value: totals.hours.toFixed(1) },
        ].map((t) => (
          <div
            key={t.label}
            className="spark-card rounded-2xl px-4 py-3"
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {t.label}
            </p>
            <p className="text-xl font-bold tab-num mt-1">{t.value}</p>
          </div>
        ))}
      </div>
      {totals.missing > 0 && (
        <p
          className="text-xs mb-3 inline-flex items-center gap-1.5"
          style={{ color: "var(--spark-flag-ink)" }}
        >
          <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0" />
          <span>
            {totals.missing} booked BA(s) in this range have no booked rate — labor totals are incomplete for their events. Set rates on the gig bookings to close the gap.
          </span>
        </p>
      )}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          style={{
            background: "var(--spark-lime, #f2f3ee)",
            color: "var(--spark-on-accent)",
          }}
        >
          <Download size={14} strokeWidth={1.75} />
          Export CSV
        </button>
      </div>
      <div
        className="rounded-xl overflow-x-auto"
        style={{ border: "1px solid var(--spark-border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs"
              style={{
                background: "rgba(var(--spark-ink-rgb),0.04)",
                color: "var(--spark-text-meta)",
              }}
            >
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Event</th>
              <th className="text-right px-3 py-2 font-medium">BAs</th>
              <th className="text-right px-3 py-2 font-medium">Hours</th>
              <th className="text-right px-3 py-2 font-medium">Labor</th>
              <th className="text-right px-3 py-2 font-medium">Spend</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-xs"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  No staffed or cost-bearing events in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.uuid}
                  style={{
                    borderTop: "1px solid rgba(var(--spark-ink-rgb),0.05)",
                  }}
                >
                  <td
                    className="px-3 py-2 mono text-xs"
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    {r.date ? formatEventDate(r.date) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {/* Walk-in titles start with the date the Date column
                        already shows; print it once. */}
                    {cleanEventName(r.name) || r.name}
                    {r.estimated && (
                      <span
                        className="mono text-[9px] ml-2"
                        style={{ color: "var(--spark-flag-ink)" }}
                        title="No clock pair for at least one BA — scheduled duration used"
                      >
                        EST.
                      </span>
                    )}
                    {r.missingRates > 0 && (
                      <span
                        className="mono text-[9px] ml-2"
                        style={{ color: "var(--spark-orange)" }}
                        title="BAs without a booked rate — labor incomplete"
                      >
                        {r.missingRates} NO RATE
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tab-num">
                    {r.baCount}
                  </td>
                  <td className="px-3 py-2 text-right tab-num">
                    {r.hours.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right tab-num">
                    {money(r.laborCost)}
                  </td>
                  <td className="px-3 py-2 text-right tab-num">
                    {money(r.spend)}
                  </td>
                  <td className="px-3 py-2 text-right tab-num font-semibold">
                    {money(r.totalCost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const SparkPnl: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [start, setStart] = useState(isoLocal(daysAgo(30)));
  const [end, setEnd] = useState(isoLocal(new Date()));

  return (
    <Layout>
      <div className="max-w-7xl space-y-5 spark-scale">
        <div className="flex flex-wrap items-center gap-2">
          <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
          <SparkHubTabs tabs={BUDGET_PNL_SUBTABS} ariaLabel="Budget & P&L views" />
        </div>
        <SparkPageHeader
          eyebrow="Budget & P&L · Internal"
          title="Event P&L"
          support="Labor (clock-in to clock-out × booked rate) plus expense-receipt spend, per event."
          action={
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={inputStyle()}
              />
              <span style={{ color: "var(--spark-text-meta)" }}>→</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={inputStyle()}
              />
            </div>
          }
        />
        {tenantId ? (
          <Suspense
            fallback={
              <div
                className="text-sm py-8"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Crunching costs…
              </div>
            }
          >
            <Table tenantId={tenantId} start={start} end={end} />
          </Suspense>
        ) : (
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            Pick a tenant first (top-left switcher).
          </p>
        )}
      </div>
    </Layout>
  );
};

export default SparkPnl;
