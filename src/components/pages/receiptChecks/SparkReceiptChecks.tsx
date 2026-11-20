import { Component, Suspense, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { fetchQuery, graphql } from "react-relay";
import { useLazyLoadQuery } from "react-relay/hooks";
import type {
  SparkReceiptChecksQuery as QueryType,
  SparkReceiptChecksQuery$data,
} from "./__generated__/SparkReceiptChecksQuery.graphql";
import type { SparkReceiptChecksCsvQuery as CsvQueryType } from "./__generated__/SparkReceiptChecksCsvQuery.graphql";
import environment from "@/api/relay/environment";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { inputColorScheme } from "@/theme/inputColorScheme";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import { RecapFlagItem } from "@/recap/RecapFlagItem";
import {
  FLAG_KIND_OPTIONS,
  csvFileName,
  defaultRange,
  flagKindLabel,
  formatMoney,
  receiptDateLabel,
  sortFlags,
} from "@/recap/receiptChecks";

/**
 * Receipt checks (staff only): receipt spend for a brand over a date range
 * — each receipt counted once, split into brand product, other items, fees
 * and tax — the flagged recaps (duplicate receipts, receipts from another
 * store, very short clock-ins, late staff filings, duplicate photos,
 * receipts that don't add up) with resolve, and the CSV for billing.
 */
const Query = graphql`
  query SparkReceiptChecksQuery(
    $tenantId: ID
    $dateFrom: String
    $dateTo: String
    $kind: String
    $unresolvedOnly: Boolean!
  ) {
    receiptSpendSummary(tenantId: $tenantId, dateFrom: $dateFrom, dateTo: $dateTo) {
      receiptRows
      totals {
        product
        other
        unitemized
        fees
        tax
        total
        receipts
      }
      recaps {
        recapId
        recapUuid
        eventName
        eventDate
        openFlags
        totals {
          product
          other
          unitemized
          fees
          tax
          total
          receipts
        }
      }
    }
    recapStaffFlags(
      tenantId: $tenantId
      dateFrom: $dateFrom
      dateTo: $dateTo
      kind: $kind
      unresolvedOnly: $unresolvedOnly
      first: 200
    ) {
      id
      recapId
      recapUuid
      tenantName
      eventName
      eventDate
      kind
      kindLabel
      severity
      explanation
      otherRecapUuid
      createdAt
      resolvedAt
      resolvedByName
      resolutionNote
      autoCleared
    }
  }
`;

const CsvQuery = graphql`
  query SparkReceiptChecksCsvQuery($tenantId: ID, $dateFrom: String, $dateTo: String) {
    receiptSpendSummary(
      tenantId: $tenantId
      dateFrom: $dateFrom
      dateTo: $dateTo
      includeCsv: true
    ) {
      csv
      receiptRows
    }
  }
`;

type Filters = {
  tenantId: string | null;
  dateFrom: string;
  dateTo: string;
  kind: string;
  unresolvedOnly: boolean;
};

const meta = { color: "var(--spark-text-meta)" } as const;

const inputStyle = (): React.CSSProperties => ({
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(var(--spark-ink-rgb),0.04)",
  border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
  color: "var(--spark-text)",
  colorScheme: inputColorScheme(),
  fontSize: 14,
});

type Summary = NonNullable<SparkReceiptChecksQuery$data["receiptSpendSummary"]>;

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="spark-card p-4">
    <p className="text-[13px]" style={meta}>
      {label}
    </p>
    <p className="text-[22px] font-semibold tabular-nums mt-0.5">{value}</p>
    {note ? (
      <p className="text-[12px] mt-0.5" style={meta}>
        {note}
      </p>
    ) : null}
  </div>
);

const SpendTable: React.FC<{ summary: Summary }> = ({ summary }) => {
  if (summary.recaps.length === 0) {
    return (
      <p className="text-[14px]" style={meta}>
        No receipts read for this range yet.
      </p>
    );
  }
  const head = "text-left text-[13px] font-medium py-2 pr-3";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]" style={{ minWidth: 640 }}>
        <thead style={meta}>
          <tr>
            <th className={head}>Event date</th>
            <th className={head}>Event</th>
            <th className={`${head} text-right`}>Receipts</th>
            <th className={`${head} text-right`}>Brand product</th>
            <th className={`${head} text-right`}>Other</th>
            <th className={`${head} text-right`}>Total</th>
            <th className={head}>Open flags</th>
          </tr>
        </thead>
        <tbody>
          {summary.recaps.map((r) => (
            <tr key={r.recapId} style={{ borderTop: "1px solid var(--spark-hairline)" }}>
              <td className="py-2 pr-3 whitespace-nowrap">{receiptDateLabel(r.eventDate)}</td>
              <td className="py-2 pr-3">
                <Link to={`/recap/view-custom/${r.recapUuid}`} className="underline">
                  {r.eventName || "Recap"}
                </Link>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.totals.receipts}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(r.totals.product)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(r.totals.other)}</td>
              <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                {formatMoney(r.totals.total)}
              </td>
              <td className="py-2 text-[13px]" style={{ color: "var(--spark-flag-ink, #ffb59d)" }}>
                {r.openFlags.map(flagKindLabel).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Results: React.FC<{ filters: Filters }> = ({ filters }) => {
  const data = useLazyLoadQuery<QueryType>(
    Query,
    {
      tenantId: filters.tenantId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      kind: filters.kind || null,
      unresolvedOnly: filters.unresolvedOnly,
    },
    { fetchPolicy: "store-and-network" },
  );
  const summary = data.receiptSpendSummary;
  const flags = sortFlags(data.recapStaffFlags);
  const t = summary?.totals;
  return (
    <>
      {t ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat
            label="Receipt spend"
            value={formatMoney(t.total)}
            note={`${t.receipts} receipt${t.receipts === 1 ? "" : "s"}, each counted once`}
          />
          <Stat label="Brand product" value={formatMoney(t.product)} />
          <Stat
            label="Other items"
            value={formatMoney(t.other)}
            note={Number(t.unitemized) > 0 ? `Plus ${formatMoney(t.unitemized)} not itemized` : "Ice, cups and supplies"}
          />
          <Stat
            label="Fees and tax"
            value={formatMoney(String(Number(t.fees) + Number(t.tax)))}
            note={`Fees ${formatMoney(t.fees)} · tax ${formatMoney(t.tax)}`}
          />
        </div>
      ) : null}

      <section className="mb-8" aria-label="Flagged recaps">
        <h2 className="text-[17px] font-semibold">Flagged recaps</h2>
        <p className="text-[13px] mb-1" style={meta}>
          Staff only. Brand users never see these.
        </p>
        {flags.length === 0 ? (
          <p className="text-[14px] py-3" style={meta}>
            Nothing flagged for these filters.
          </p>
        ) : (
          <ul className="list-none p-0 m-0">
            {flags.map((f) => (
              <RecapFlagItem
                key={f.id}
                flag={f}
                context={
                  <span style={meta}>
                    {[f.tenantName, f.eventName, receiptDateLabel(f.eventDate)].filter(Boolean).join(" · ")}
                    {" · "}
                    <Link to={`/recap/view-custom/${f.recapUuid}`} className="underline">
                      Open recap
                    </Link>
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {summary ? (
        <section aria-label="Spend by recap">
          <h2 className="text-[17px] font-semibold mb-2">Spend by recap</h2>
          <SpendTable summary={summary} />
        </section>
      ) : null}
    </>
  );
};

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="text-[14px]" style={meta}>
        Couldn't load receipt checks. Try again in a moment.
      </p>
    ) : (
      this.props.children
    );
  }
}

export default function SparkReceiptChecks() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const tenantMeta = useAuthStore((s) => s.tenantMeta);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const showAlert = useAlertStore((s) => s.showAlert);
  const brandName = tenantDisplayName(tenantMeta?.requestUrlName, tenantSlug);
  const range = defaultRange();
  const [allBrands, setAllBrands] = useState(!tenantId);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [kind, setKind] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [exporting, setExporting] = useState(false);

  const filters: Filters = {
    tenantId: allBrands ? null : tenantId,
    dateFrom,
    dateTo,
    kind,
    unresolvedOnly,
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetchQuery<CsvQueryType>(environment, CsvQuery, {
        tenantId: filters.tenantId,
        dateFrom,
        dateTo,
      }).toPromise();
      const csv = res?.receiptSpendSummary?.csv;
      if (!csv || !res?.receiptSpendSummary?.receiptRows) {
        showAlert("No receipts in that range.", "warning");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = csvFileName(allBrands ? "" : brandName || "brand", dateFrom, dateTo);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto spark-scale">
      <SparkPageHeader
        className="mb-5"
        title="Receipt checks"
        support="What Spark read off recap receipts: spend for billing, and recaps that need a second look."
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-6 text-[14px]">
        <label className="flex flex-col gap-1">
          <span style={meta}>Brand</span>
          <select
            value={allBrands ? "all" : "current"}
            onChange={(e) => setAllBrands(e.target.value === "all")}
            style={inputStyle()}
          >
            {tenantId ? <option value="current">{brandName || "Selected brand"}</option> : null}
            <option value="all">All brands</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span style={meta}>Event from</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle()} />
        </label>
        <label className="flex flex-col gap-1">
          <span style={meta}>Event to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle()} />
        </label>
        <label className="flex flex-col gap-1">
          <span style={meta}>Flag kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle()}>
            {FLAG_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          <span>Unresolved only</span>
        </label>
      </div>

      <Boundary key={JSON.stringify(filters)}>
        <Suspense
          fallback={
            <p className="text-[14px]" style={meta}>
              Loading…
            </p>
          }
        >
          <Results filters={filters} />
        </Suspense>
      </Boundary>
    </div>
  );
}
