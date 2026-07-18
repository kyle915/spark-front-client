import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { PayrollTimesheetQuery } from "@/api/queries/PayrollTimesheetQuery";
import type { PayrollTimesheetQuery as PayrollTimesheetQueryType } from "@api/queries/__generated__/PayrollTimesheetQuery.graphql";

/**
 * Payroll timesheet — per-BA worked hours + estimated pay for a pay period,
 * with a Wingspan/Gusto-ready CSV. Hours come from real clock data (scheduled
 * fallback flagged); pay is hours×booked-rate and only counts shifts that had
 * a rate. Pick a date range, review, download.
 */
type Sheet = PayrollTimesheetQueryType["response"]["payrollTimesheet"];
type Row = Sheet["rows"][number];

const money = (n: number | null | undefined): string =>
  n == null ? "—" : `$${n.toFixed(2)}`;

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function downloadCsv(sheet: Sheet) {
  const header = [
    "BA",
    "Email",
    "Shifts",
    "Hours",
    "Estimated shifts",
    "Est. pay",
    "Shifts missing rate",
  ];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  for (const r of sheet.rows) {
    lines.push(
      [
        esc(r.name),
        esc(r.email || ""),
        String(r.shifts),
        String(r.hours),
        String(r.estimatedShifts),
        r.estimatedPay == null ? "" : String(r.estimatedPay),
        String(r.shiftsMissingRate),
      ].join(","),
    );
  }
  lines.push(
    [esc("TOTAL"), "", "", String(sheet.totalHours), "",
     sheet.totalEstimatedPay == null ? "" : String(sheet.totalEstimatedPay), ""].join(","),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${sheet.startDate}_to_${sheet.endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Inner: React.FC<{ startDate: string; endDate: string }> = ({
  startDate,
  endDate,
}) => {
  const data = useLazyLoadQuery<PayrollTimesheetQueryType>(
    PayrollTimesheetQuery,
    { startDate, endDate },
    { fetchPolicy: "store-and-network" },
  );
  const sheet = data?.payrollTimesheet;
  const rows: Row[] = (sheet?.rows ?? []) as Row[];
  const [reviewOnly, setReviewOnly] = useState(false);
  const shown = reviewOnly ? rows.filter((r) => r.needsReview) : rows;

  if (!sheet || rows.length === 0) {
    return (
      <p
        className="p-10 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        No worked shifts in this range.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}
        >
          {rows.length} BA{rows.length === 1 ? "" : "s"} · {sheet.totalHours}h
          {sheet.totalEstimatedPay != null
            ? ` · ${money(sheet.totalEstimatedPay)} est.`
            : ""}
        </span>
        {sheet.flaggedRows > 0 ? (
          <button
            onClick={() => setReviewOnly((v) => !v)}
            className="mono text-[11px] rounded-full"
            style={{
              letterSpacing: "0.08em",
              padding: "4px 12px",
              color: reviewOnly ? "#0a0d09" : "var(--spark-orange)",
              background: reviewOnly ? "var(--spark-orange)" : "rgba(239,90,42,0.12)",
              border: "1px solid rgba(239,90,42,0.4)",
            }}
          >
            ⚑ {sheet.flaggedRows} NEED{sheet.flaggedRows === 1 ? "S" : ""} REVIEW
            {reviewOnly ? " ✓" : ""}
          </button>
        ) : null}
        <button
          onClick={() => downloadCsv(sheet)}
          className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--spark-lime)", color: "#0a0d09", border: "none" }}
        >
          ↓ Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
              {["BA", "Shifts", "Hours", "Est. pay", "Notes"].map((h, i) => (
                <th
                  key={h}
                  className="mono text-[10px] px-3 py-2"
                  style={{
                    letterSpacing: "0.12em",
                    color: "rgba(255,255,255,0.45)",
                    textAlign: i === 0 || i === 4 ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.ambassadorUuid}
                style={{ borderBottom: "1px solid var(--spark-border)" }}
              >
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {r.name}
                    {r.needsReview ? (
                      <span
                        className="mono text-[9px] ml-2"
                        style={{
                          letterSpacing: "0.06em",
                          color: "var(--spark-orange)",
                          background: "rgba(239,90,42,0.12)",
                          border: "1px solid rgba(239,90,42,0.35)",
                          borderRadius: 999,
                          padding: "1px 6px",
                        }}
                      >
                        ⚑ REVIEW
                      </span>
                    ) : null}
                  </p>
                  {r.email ? (
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {r.email}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.shifts}
                </td>
                <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.hours}
                  {r.estimatedShifts > 0 ? (
                    <span
                      title={`${r.estimatedShifts} shift(s) used scheduled length (no clock pair)`}
                      style={{ color: "var(--spark-gold)" }}
                    >
                      {" "}~
                    </span>
                  ) : null}
                </td>
                <td
                  className="px-3 py-2 text-right font-semibold"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {money(r.estimatedPay)}
                </td>
                <td className="px-3 py-2 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {[
                    r.shiftsMissingRate > 0
                      ? `${r.shiftsMissingRate} no rate`
                      : null,
                    r.estimatedShifts > 0
                      ? `${r.estimatedShifts} unverified`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-bold">Total</td>
              <td />
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {sheet.totalHours}
              </td>
              <td className="px-3 py-2 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {money(sheet.totalEstimatedPay)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        Hours are real clock in→out; a <span style={{ color: "var(--spark-gold)" }}>~</span> means a
        shift fell back to its scheduled length (no clock pair). Estimated pay is
        hours × booked rate — shifts with no booked rate contribute hours but no
        dollars.
      </p>
    </>
  );
};

export default function SparkPayroll() {
  // Default to the last 14 days (a common pay period).
  const [start, setStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return ymd(d);
  });
  const [end, setEnd] = useState<string>(() => ymd(new Date()));
  const [applied, setApplied] = useState<{ s: string; e: string }>({
    s: start,
    e: end,
  });

  const inputStyle = {
    background: "var(--spark-bg, #0d0f10)",
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
    borderRadius: 10,
    padding: "8px 10px",
  } as const;

  return (
    <div className="p-5 md:p-8">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <div className="mb-5">
        <h1 className="display text-2xl font-bold">Payroll timesheet</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Worked hours + estimated pay per BA for a pay period. Export a CSV for
          Wingspan.
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap mb-5">
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
          FROM
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
          TO
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </label>
        <button
          onClick={() => setApplied({ s: start, e: end })}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          Run
        </button>
      </div>

      <Suspense
        fallback={
          <p
            className="p-10 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Computing hours…
          </p>
        }
      >
        <Inner key={`${applied.s}:${applied.e}`} startDate={applied.s} endDate={applied.e} />
      </Suspense>
    </div>
  );
}
