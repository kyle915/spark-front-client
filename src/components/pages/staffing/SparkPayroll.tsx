import StatusChip from "@/shared/StatusChip";
import { Fragment, Suspense, useState } from "react";
import TimesheetShiftRows from "./TimesheetShiftRows";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { PayrollTimesheetQuery } from "@/api/queries/PayrollTimesheetQuery";
import type { PayrollTimesheetQuery as PayrollTimesheetQueryType } from "@api/queries/__generated__/PayrollTimesheetQuery.graphql";
import {
  ApprovePayrollHoursMutation,
  MarkPayrollPaidMutation,
  UnapprovePayrollHoursMutation,
} from "@/api/mutations/PayrollMutations";
import type { PayrollMutationsApproveMutation as ApproveType } from "@api/mutations/__generated__/PayrollMutationsApproveMutation.graphql";
import type { PayrollMutationsMarkPaidMutation as MarkPaidType } from "@api/mutations/__generated__/PayrollMutationsMarkPaidMutation.graphql";
import type { PayrollMutationsUnapproveMutation as UnapproveType } from "@api/mutations/__generated__/PayrollMutationsUnapproveMutation.graphql";
import { useTenantSelection } from "@/catalogs/useTenantSelection";
import { useAlertStore } from "@/store/alertStore";

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

const Inner: React.FC<{ startDate: string; endDate: string; tenantId: string }> = ({
  startDate,
  endDate,
  tenantId,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<PayrollTimesheetQueryType>(
    PayrollTimesheetQuery,
    { startDate, endDate, tenantId },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const sheet = data?.payrollTimesheet;
  const rows: Row[] = (sheet?.rows ?? []) as Row[];
  const [reviewOnly, setReviewOnly] = useState(false);
  // "Approve all" is two-step: the first click arms it, the second commits.
  // True while an approve-all sits in its undo window.
  const [held, setHeld] = useState(false);
  const showUndoable = useAlertStore((s) => s.showUndoable);
  // Which ambassador's shifts are expanded under their row (one at a time).
  const [openUuid, setOpenUuid] = useState<string | null>(null);
  const shown = reviewOnly ? rows.filter((r) => r.needsReview) : rows;

  const [commitApprove, approving] = useMutation<ApproveType>(ApprovePayrollHoursMutation);
  const [commitMarkPaid, paying] = useMutation<MarkPaidType>(MarkPayrollPaidMutation);
  const [commitUnapprove, unapproving] = useMutation<UnapproveType>(UnapprovePayrollHoursMutation);
  const busy = approving || paying || unapproving;

  const runPayroll = (
    kind: "approve" | "paid" | "unapprove",
    ambassadorUuids: string[],
  ) => {
    if (ambassadorUuids.length === 0) return;
    const commit =
      kind === "approve" ? commitApprove : kind === "paid" ? commitMarkPaid : commitUnapprove;
    commit({
      variables: { input: { startDate, endDate, tenantId, ambassadorUuids } },
      onCompleted: (resp: Record<string, { success?: boolean; message?: string } | null>) => {
        const r = Object.values(resp)[0];
        showAlert(r?.message || "Done.", r?.success ? "success" : "error");
        if (r?.success) setRefreshKey((k) => k + 1);
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };
  const unapprovedUuids = rows.filter((r) => !r.approved).map((r) => r.ambassadorUuid);
  const approvedUnpaidUuids = rows
    .filter((r) => r.approved && !r.paidAt)
    .map((r) => r.ambassadorUuid);

  if (!sheet || rows.length === 0) {
    return (
      <p
        className="p-10 text-center text-sm"
        style={{ color: "var(--spark-text-meta)" }}
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
          style={{ letterSpacing: "0.12em", color: "var(--spark-text-secondary)" }}
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
            {sheet.flaggedRows} NEED{sheet.flaggedRows === 1 ? "S" : ""} REVIEW
            {reviewOnly ? " ✓" : ""}
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {unapprovedUuids.length > 0 ? (
            (
              <button
                onClick={() => {
                  const uuids = unapprovedUuids;
                  setHeld(true);
                  showUndoable(
                    `Approving hours for ${uuids.length} ${uuids.length === 1 ? "person" : "people"}.`,
                    () => {
                      setHeld(false);
                      runPayroll("approve", uuids);
                    },
                    { onUndo: () => setHeld(false) },
                  );
                }}
                disabled={busy || held}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
              >
                Approve all ({unapprovedUuids.length})
              </button>
            )
          ) : approvedUnpaidUuids.length > 0 ? (
            <button
              onClick={() => runPayroll("paid", approvedUnpaidUuids)}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
            >
              Mark all paid ({approvedUnpaidUuids.length})
            </button>
          ) : null}
          <button
            onClick={() => downloadCsv(sheet)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "#0a0d09", border: "none" }}
          >
            ↓ Download CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
              {["BA", "Shifts", "Hours", "Est. pay", "Status", "Notes"].map((h, i) => (
                <th
                  key={h}
                  className="mono text-[10px] px-3 py-2"
                  style={{
                    letterSpacing: "0.12em",
                    color: "var(--spark-text-meta)",
                    textAlign: i === 0 || i >= 4 ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Fragment key={r.ambassadorUuid}>
              <tr
                style={{ borderBottom: "1px solid var(--spark-border)" }}
              >
                <td className="px-3 py-2">
                  <p className="font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenUuid((cur) =>
                          cur === r.ambassadorUuid ? null : r.ambassadorUuid,
                        )
                      }
                      aria-expanded={openUuid === r.ambassadorUuid}
                      title="Show the shifts behind this total"
                      className="inline-flex items-center gap-1.5 text-left underline-offset-2 hover:underline"
                      style={{ background: "transparent", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer" }}
                    >
                      <span aria-hidden style={{ color: "var(--spark-text-meta)" }}>
                        {openUuid === r.ambassadorUuid ? "▾" : "▸"}
                      </span>
                      {r.name}
                    </button>
                    {r.needsReview ? (
                      <span className="ml-2">
                        <StatusChip status="review" small>
                          Review
                        </StatusChip>
                      </span>
                    ) : null}
                  </p>
                  {r.email ? (
                    <p className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
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
                <td className="px-3 py-2">
                  {r.paidAt ? (
                    <StatusChip status="paid">Paid</StatusChip>
                  ) : r.approved ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runPayroll("paid", [r.ambassadorUuid])}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
                      >
                        Mark paid
                      </button>
                      <button
                        onClick={() => runPayroll("unapprove", [r.ambassadorUuid])}
                        disabled={busy}
                        title="Undo approval"
                        className="text-xs disabled:opacity-50"
                        style={{ color: "var(--spark-text-meta)" }}
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => runPayroll("approve", [r.ambassadorUuid])}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
                    >
                      Approve
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
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
              {openUuid === r.ambassadorUuid ? (
                <tr>
                  <td colSpan={6} className="px-3 pb-3">
                    <TimesheetShiftRows
                      startDate={startDate}
                      endDate={endDate}
                      tenantId={tenantId}
                      ambassadorUuid={r.ambassadorUuid}
                      onChanged={() => setRefreshKey((k) => k + 1)}
                    />
                  </td>
                </tr>
              ) : null}
              </Fragment>
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
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] mt-4" style={{ color: "var(--spark-text-meta)" }}>
        Hours are real clock in→out; a <span style={{ color: "var(--spark-gold)" }}>~</span> means a
        shift fell back to its scheduled length (no clock pair). Estimated pay is
        hours × booked rate — shifts with no booked rate contribute hours but no
        dollars.
      </p>
    </>
  );
};

// Wraps the timesheet with a client (tenant) selector — payroll close-out is
// per-client, so the sheet is scoped to one tenant (defaults to the first the
// admin can access; a lone-tenant client sees no picker).
const Body: React.FC<{ startDate: string; endDate: string }> = ({
  startDate,
  endDate,
}) => {
  const { tenantOptions, selectedTenantId, setSelectedTenantId } =
    useTenantSelection();
  if (tenantOptions.length === 0) {
    return (
      <p className="p-10 text-center text-sm" style={{ color: "var(--spark-text-meta)" }}>
        No client available.
      </p>
    );
  }
  return (
    <>
      {tenantOptions.length > 1 ? (
        <label
          className="flex flex-col gap-1 text-[11px] mb-4"
          style={{ color: "var(--spark-text-meta)", maxWidth: 280 }}
        >
          CLIENT
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            style={{
              background: "var(--spark-bg, #0d0f10)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            {tenantOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Inner
        key={`${startDate}:${endDate}:${selectedTenantId}`}
        startDate={startDate}
        endDate={endDate}
        tenantId={selectedTenantId}
      />
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
        style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
      >
        WORKSPACE
      </p>
      <div className="mb-5">
        <h1 className="display text-2xl font-bold">Payroll timesheet</h1>
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Worked hours + estimated pay per BA for a pay period. Export a CSV for
          Wingspan.
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
            style={{ color: "var(--spark-text-meta)" }}
          >
            Computing hours…
          </p>
        }
      >
        <Body startDate={applied.s} endDate={applied.e} />
      </Suspense>
    </div>
  );
}
