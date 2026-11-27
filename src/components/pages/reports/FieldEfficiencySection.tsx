import { Suspense } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery } from "react-relay/hooks";
import type { FieldEfficiencySectionQuery as QueryType } from "./__generated__/FieldEfficiencySectionQuery.graphql";
import {
  cleanRates,
  efficiencyHeadline,
  formatStoreEfficiencyLabel,
  samplesPerHourText,
  unitsPerHourText,
  unitsSoldText,
  type EfficiencyRow,
} from "./fieldEfficiency";

const Query = graphql`
  query FieldEfficiencySectionQuery($tenantId: ID!, $startDate: String, $endDate: String) {
    tenantFieldEfficiency(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      total {
        label
        recaps
        sampled
        sold
        hours
        samplesPerHour
        unitsPerHour
      }
      byWeekday {
        label
        recaps
        sampled
        sold
        hours
        samplesPerHour
        unitsPerHour
      }
      byDaypart {
        label
        recaps
        sampled
        sold
        hours
        samplesPerHour
        unitsPerHour
      }
      topStores {
        label
        recaps
        sampled
        sold
        hours
        samplesPerHour
        unitsPerHour
      }
      recapsWithoutHours
      headline
      ratesHeld
    }
  }
`;

const meta = { color: "var(--spark-text-meta)" } as const;

const Table: React.FC<{
  title: string;
  first: string;
  rows: readonly EfficiencyRow[];
  showSold?: boolean;
  cleanStoreLabels?: boolean;
}> = ({ title, first, rows, showSold = false, cleanStoreLabels = false }) => (
  <section className="spark-card p-5 overflow-hidden" aria-label={title}>
    <h4 className="label-mini mb-3">{title}</h4>
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
            <th
              className="text-left text-xs font-medium pb-2.5 pr-4 whitespace-nowrap"
              style={meta}
            >
              {first}
            </th>
            <th
              className="text-right text-xs font-medium pb-2.5 pl-4 sm:pl-6 whitespace-nowrap"
              style={meta}
            >
              Activations
            </th>
            {showSold ? (
              <th
                className="text-right text-xs font-medium pb-2.5 pl-4 sm:pl-6 whitespace-nowrap"
                style={meta}
              >
                Units sold
              </th>
            ) : null}
            <th
              className="text-right text-xs font-medium pb-2.5 pl-4 sm:pl-6 whitespace-nowrap"
              style={meta}
            >
              Samples / hr
            </th>
            <th
              className="text-right text-xs font-medium pb-2.5 pl-4 sm:pl-6 whitespace-nowrap"
              style={meta}
            >
              Sold / hr
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const displayLabel = cleanStoreLabels
              ? formatStoreEfficiencyLabel(r.label) || r.label
              : r.label;
            return (
              <tr
                key={`${idx}-${r.label}`}
                style={idx > 0 ? { borderTop: "1px solid var(--spark-hairline)" } : undefined}
              >
                <td
                  className={
                    cleanStoreLabels
                      ? "py-2.5 pr-4 max-w-[180px] sm:max-w-[320px] md:max-w-[460px] truncate font-medium"
                      : "py-2.5 pr-4 truncate font-medium"
                  }
                  title={displayLabel}
                >
                  {displayLabel}
                </td>
                <td className="py-2.5 pl-4 sm:pl-6 text-right tabular-nums whitespace-nowrap">
                  {r.recaps}
                </td>
                {showSold ? (
                  <td className="py-2.5 pl-4 sm:pl-6 text-right tabular-nums font-semibold whitespace-nowrap">
                    {unitsSoldText(r)}
                  </td>
                ) : null}
                <td className="py-2.5 pl-4 sm:pl-6 text-right tabular-nums whitespace-nowrap">
                  {samplesPerHourText(r)}
                </td>
                <td className="py-2.5 pl-4 sm:pl-6 text-right tabular-nums font-semibold whitespace-nowrap">
                  {unitsPerHourText(r)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

const Body: React.FC<{ tenantId: string; startDate: string; endDate: string }> = (props) => {
  const data = useLazyLoadQuery<QueryType>(Query, props, {
    fetchPolicy: "store-and-network",
  });
  const eff = data.tenantFieldEfficiency;
  if (!eff || eff.total.recaps === 0) {
    return (
      <p className="text-sm" style={meta}>
        No approved recaps in this range yet.
      </p>
    );
  }
  if (eff.total.hours <= 0) {
    return (
      <p className="text-sm" style={meta}>
        Per-hour results need clocked shifts. None of the {eff.total.recaps} activations in
        this range have clock-in and clock-out times.
      </p>
    );
  }
  const weekdays = eff.byWeekday.map(cleanRates);
  const dayparts = eff.byDaypart.map(cleanRates);
  const stores = eff.topStores.map(cleanRates);
  const headline =
    eff.headline.trim() || efficiencyHeadline(weekdays, dayparts) || "";
  return (
    <>
      <div className="flex items-end gap-10 flex-wrap mb-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums" style={{ letterSpacing: "-0.03em" }}>
            {samplesPerHourText(eff.total)}
          </p>
          <p className="label-mini mt-1">Samples per staffed hour</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums" style={{ letterSpacing: "-0.03em" }}>
            {unitsPerHourText(eff.total)}
          </p>
          <p className="label-mini mt-1">Units sold per staffed hour</p>
        </div>
        {headline ? <p className="text-sm max-w-md">{headline}</p> : null}
      </div>
      {weekdays.length > 0 || dayparts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {weekdays.length > 0 ? (
            <Table title="By day of week" first="Day" rows={weekdays} />
          ) : null}
          {dayparts.length > 0 ? (
            <Table title="By time of day" first="Shift start" rows={dayparts} />
          ) : null}
        </div>
      ) : null}
      {stores.length > 0 ? (
        <div className={weekdays.length > 0 || dayparts.length > 0 ? "mt-4" : undefined}>
          <Table
            title="Top stores by units sold"
            first="Store"
            rows={stores}
            showSold
            cleanStoreLabels
          />
        </div>
      ) : null}
      <p className="text-xs mt-3" style={meta}>
        Hours are clocked ambassador time.
        {eff.recapsWithoutHours > 0
          ? ` ${eff.recapsWithoutHours} activation${eff.recapsWithoutHours === 1 ? " has" : "s have"} no clock times and ${eff.recapsWithoutHours === 1 ? "is" : "are"} left out of the per-hour figures.`
          : ""}
        {eff.ratesHeld > 0
          ? " A per-hour figure is held when the clocked time cannot support it."
          : ""}
      </p>
    </>
  );
};

/**
 * Which stores, days and times produce the most per staffed hour
 * (needs tenantFieldEfficiency on the server — spark-api #1361).
 */
const FieldEfficiencySection: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
}> = (props) => (
  <div>
    <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
      What works best
    </h3>
    <p className="text-sm mb-3" style={meta}>
      Samples and sales per staffed hour, by day, time and store.
    </p>
    <Suspense
      fallback={
        <p className="text-sm" style={meta}>
          Working out per-hour results…
        </p>
      }
    >
      <Body {...props} />
    </Suspense>
  </div>
);

export default FieldEfficiencySection;
