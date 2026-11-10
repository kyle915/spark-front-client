import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { CampaignCostQuery } from "@/api/queries/CampaignCostQuery";
import type { CampaignCostQuery as CampaignCostQueryType } from "@api/queries/__generated__/CampaignCostQuery.graphql";
import { ClientLiveTokenQuery } from "@/api/queries/ClientLiveTokenQuery";
import type { ClientLiveTokenQuery as ClientLiveTokenQueryType } from "@api/queries/__generated__/ClientLiveTokenQuery.graphql";
import { clientLivePublicUrl } from "@/utils/publicHosts";

/**
 * Campaign cost & margin — what each brand's program cost over a date range
 * (labor from clock×rate + receipt spend, both real), with an optional revenue
 * the admin types per campaign to see margin. The founder-facing money lens.
 */
type Report = CampaignCostQueryType["response"]["campaignCost"];
type Row = Report["rows"][number];

const money = (n: number | null | undefined): string =>
  n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const Inner: React.FC<{ startDate: string; endDate: string }> = ({
  startDate,
  endDate,
}) => {
  const data = useLazyLoadQuery<CampaignCostQueryType>(
    CampaignCostQuery,
    { startDate, endDate },
    { fetchPolicy: "store-and-network" },
  );
  const report = data?.campaignCost;
  const rows: Row[] = (report?.rows ?? []) as Row[];
  // Admin-entered revenue per campaign (client-side only — Spark has no
  // client sell-price). Keyed by tenantId; drives the margin column.
  const [revenue, setRevenue] = useState<Record<string, string>>({});
  const env = useRelayEnvironment();
  const [copied, setCopied] = useState<string | null>(null);

  const shareLive = (tenantId: string) => {
    fetchQuery<ClientLiveTokenQueryType>(env, ClientLiveTokenQuery, { tenantId })
      .toPromise()
      .then((res) => {
        const token = res?.clientLiveToken;
        if (!token) return;
        const url = clientLivePublicUrl(token);
        navigator.clipboard?.writeText(url).catch(() => {});
        setCopied(tenantId);
        window.setTimeout(() => setCopied((c) => (c === tenantId ? null : c)), 2500);
      })
      .catch(() => {});
  };

  const totalRevenue = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const v = parseFloat(revenue[r.tenantId] || "");
        return sum + (isNaN(v) ? 0 : v);
      }, 0),
    [rows, revenue],
  );

  if (!report || rows.length === 0) {
    return (
      <p className="p-10 text-center text-sm" style={{ color: "var(--spark-text-meta)" }}>
        No campaign activity in this range.
      </p>
    );
  }

  const margin = (r: Row): number | null => {
    const v = parseFloat(revenue[r.tenantId] || "");
    if (isNaN(v)) return null;
    return v - r.totalCost;
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="mono text-[11px]" style={{ letterSpacing: "0.12em", color: "var(--spark-text-secondary)" }}>
          {rows.length} CAMPAIGN{rows.length === 1 ? "" : "S"} · {money(report.totalCost)} COST
          {" "}({money(report.totalLabor)} labor · {money(report.totalSpend)} spend)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
              {["Campaign", "Events", "Hours", "Labor", "Spend", "Cost", "Revenue", "Margin"].map((h, i) => (
                <th
                  key={h}
                  className="mono text-[10px] px-3 py-2"
                  style={{
                    letterSpacing: "0.12em",
                    color: "var(--spark-text-meta)",
                    textAlign: i === 0 ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = margin(r);
              return (
                <tr key={r.tenantId} style={{ borderBottom: "1px solid var(--spark-border)" }}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.tenantName}</p>
                    <p className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
                      {r.shifts} BA-shift{r.shifts === 1 ? "" : "s"}
                      {r.eventsMissingRates > 0 ? (
                        <span title="Some events have BAs with no booked rate — labor is understated" style={{ color: "var(--spark-gold)" }}>
                          {"  "}· {r.eventsMissingRates} missing rate
                        </span>
                      ) : null}
                    </p>
                    <button
                      onClick={() => shareLive(r.tenantId)}
                      className="mono text-[9px] mt-1"
                      style={{
                        letterSpacing: "0.06em",
                        color: copied === r.tenantId ? "var(--spark-lime)" : "rgba(255,255,255,0.5)",
                        background: "transparent",
                        border: "1px solid var(--spark-border)",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                      title="Copy a no-login live link to share with this client"
                    >
                      {copied === r.tenantId ? "✓ COPIED" : "⧉ SHARE LIVE LINK"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.events}</td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.hours}</td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.laborCost)}</td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.spend)}</td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.totalCost)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="—"
                      value={revenue[r.tenantId] ?? ""}
                      onChange={(e) => setRevenue((prev) => ({ ...prev, [r.tenantId]: e.target.value }))}
                      className="w-24 text-right rounded px-2 py-1"
                      style={{
                        background: "var(--spark-bg, #0d0f10)",
                        border: "1px solid var(--spark-border)",
                        color: "var(--spark-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: m == null ? "rgba(255,255,255,0.35)" : m >= 0 ? "var(--spark-lime)" : "var(--spark-orange)",
                    }}
                  >
                    {m == null ? "—" : money(m)}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="px-3 py-2 font-bold">Total</td>
              <td />
              <td />
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(report.totalLabor)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(report.totalSpend)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(report.totalCost)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{totalRevenue > 0 ? money(totalRevenue) : "—"}</td>
              <td
                className="px-3 py-2 text-right font-bold"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: totalRevenue > 0 ? (totalRevenue - report.totalCost >= 0 ? "var(--spark-lime)" : "var(--spark-orange)") : "rgba(255,255,255,0.35)",
                }}
              >
                {totalRevenue > 0 ? money(totalRevenue - report.totalCost) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] mt-4" style={{ color: "var(--spark-text-meta)" }}>
        Labor = clocked hours × booked rate; spend = expense receipts. Both are
        real. Enter what you billed the client under Revenue to see margin —
        that figure stays in your browser (Spark doesn't store client pricing).
      </p>
    </>
  );
};

export default function SparkCampaignCost() {
  const [start, setStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // month-to-date default
    return ymd(d);
  });
  const [end, setEnd] = useState<string>(() => ymd(new Date()));
  const [applied, setApplied] = useState<{ s: string; e: string }>({ s: start, e: end });

  const inputStyle = {
    background: "var(--spark-bg, #0d0f10)",
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
    borderRadius: 10,
    padding: "8px 10px",
  } as const;

  return (
    <div className="p-5 md:p-8">
      <p className="mono text-[10px] mb-1" style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}>
        WORKSPACE
      </p>
      <div className="mb-5">
        <h1 className="display text-2xl font-bold">Campaign cost &amp; margin</h1>
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          What each program cost — labor + spend, straight from the clock and
          receipt data. Add revenue to see margin.
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap mb-5">
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
          FROM
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
          TO
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </label>
        <button
          onClick={() => setApplied({ s: start, e: end })}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
        >
          Run
        </button>
      </div>

      <Suspense
        fallback={
          <p className="p-10 text-center text-sm" style={{ color: "var(--spark-text-meta)" }}>
            Computing costs…
          </p>
        }
      >
        <Inner key={`${applied.s}:${applied.e}`} startDate={applied.s} endDate={applied.e} />
      </Suspense>
    </div>
  );
}
