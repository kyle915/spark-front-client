import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantRecapFieldTotalsQuery } from "@/api/queries/TenantRecapFieldTotalsQuery";
import type { TenantRecapFieldTotalsQuery as QueryType } from "@api/queries/__generated__/TenantRecapFieldTotalsQuery.graphql";
import { fieldTotalNote, fieldTotalValue } from "./recapFieldTotals";

const SHOW_FIRST = 8;

const Body: React.FC<{ tenantId: string; startDate: string; endDate: string }> = ({
  tenantId,
  startDate,
  endDate,
}) => {
  const data = useLazyLoadQuery<QueryType>(
    TenantRecapFieldTotalsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-and-network" },
  );
  const sections = data.tenantRecapFieldTotals;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (sections.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
        No approved recaps with numbers in this range yet.
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((sec) => {
        const all = open[sec.section];
        const shown = all ? sec.fields : sec.fields.slice(0, SHOW_FIRST);
        return (
          <section key={sec.section} className="spark-card p-5" aria-label={sec.section}>
            <h4 className="label-mini mb-3">{sec.section}</h4>
            <dl className="m-0">
              {shown.map((f) => (
                <div
                  key={f.label}
                  className="flex items-baseline justify-between gap-4 py-2"
                  style={{ borderBottom: "1px solid var(--spark-hairline)" }}
                >
                  <dt className="text-sm min-w-0">
                    {f.label}
                    <span
                      className="block text-xs"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {fieldTotalNote(f)}
                    </span>
                  </dt>
                  <dd className="m-0 text-base font-semibold tabular-nums shrink-0">
                    {fieldTotalValue(f)}
                  </dd>
                </div>
              ))}
            </dl>
            {sec.fields.length > SHOW_FIRST ? (
              <button
                type="button"
                className="mt-3 text-sm underline"
                style={{ color: "var(--spark-text-secondary)" }}
                onClick={() => setOpen((o) => ({ ...o, [sec.section]: !all }))}
              >
                {all ? "Show fewer" : `Show all ${sec.fields.length}`}
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
};

/**
 * Everything the brand's approved recaps collected, totalled field by field
 * under the recap form's own sections (needs spark-api #1359).
 */
const RecapFieldTotalsSection: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
}> = (props) => (
  <div>
    <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
      All recap metrics
    </h3>
    <p className="text-sm mb-3" style={{ color: "var(--spark-text-meta)" }}>
      Every number your approved recaps collected in this range, added up by
      question. Prices, rates and ratings are averaged.
    </p>
    <Suspense
      fallback={
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Adding up recap answers…
        </p>
      }
    >
      <Body {...props} />
    </Suspense>
  </div>
);

export default RecapFieldTotalsSection;
