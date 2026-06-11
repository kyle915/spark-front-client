import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { EventPnlQuery } from "@/api/queries/EventPnlQuery";
import type { EventPnlQuery as EventPnlQueryType } from "@api/queries/__generated__/EventPnlQuery.graphql";
import { useAuthStore } from "@/store/authStore";

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

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  colorScheme: "dark",
};

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
            style={{ borderTop: "2px solid var(--spark-lime, #c5f546)" }}
          >
            <p
              className="mono text-[9px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
              }}
            >
              {t.label}
            </p>
            <p className="text-xl font-bold tab-num">{t.value}</p>
          </div>
        ))}
      </div>
      {totals.missing > 0 && (
        <p
          className="text-xs mb-3"
          style={{ color: "rgba(255,200,80,0.85)" }}
        >
          ⚠ {totals.missing} booked BA(s) in this range have no booked
          rate — labor totals are incomplete for their events. Set rates
          on the gig bookings to close the gap.
        </p>
      )}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
          style={{
            background: "var(--spark-lime, #c5f546)",
            color: "#0a0d09",
          }}
        >
          Export CSV
        </button>
      </div>
      <div
        className="rounded-xl overflow-x-auto"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="mono text-[10px]"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.12em",
              }}
            >
              <th className="text-left px-3 py-2 font-normal">DATE</th>
              <th className="text-left px-3 py-2 font-normal">EVENT</th>
              <th className="text-right px-3 py-2 font-normal">BAs</th>
              <th className="text-right px-3 py-2 font-normal">HOURS</th>
              <th className="text-right px-3 py-2 font-normal">LABOR</th>
              <th className="text-right px-3 py-2 font-normal">SPEND</th>
              <th className="text-right px-3 py-2 font-normal">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-xs"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  No staffed or cost-bearing events in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.uuid}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <td
                    className="px-3 py-2 mono text-xs"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {r.date ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.name}
                    {r.estimated && (
                      <span
                        className="mono text-[9px] ml-2"
                        style={{ color: "rgba(255,200,80,0.8)" }}
                        title="No clock pair for at least one BA — scheduled duration used"
                      >
                        EST.
                      </span>
                    )}
                    {r.missingRates > 0 && (
                      <span
                        className="mono text-[9px] ml-2"
                        style={{ color: "rgba(255,120,90,0.85)" }}
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.22em",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          OUTPUTS · COST LENS
        </p>
        <h1 className="text-2xl font-bold mt-1 mb-1">P&L</h1>
        <p
          className="text-xs mb-4"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Labor (clock-in → clock-out × booked rate) plus expense-receipt
          spend, per event. Ignite-internal.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>→</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
        {tenantId ? (
          <Suspense
            fallback={
              <div
                className="text-sm py-8"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Crunching costs…
              </div>
            }
          >
            <Table tenantId={tenantId} start={start} end={end} />
          </Suspense>
        ) : (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Pick a tenant first (top-left switcher).
          </p>
        )}
      </div>
    </Layout>
  );
};

export default SparkPnl;
