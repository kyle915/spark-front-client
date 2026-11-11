import { Suspense, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TenantRecapFieldTotalsQuery } from "@/api/queries/TenantRecapFieldTotalsQuery";
import type { TenantRecapFieldTotalsQuery as QueryType } from "@api/queries/__generated__/TenantRecapFieldTotalsQuery.graphql";
import { SetBoothDayCountingMutation } from "@/api/mutations/SetBoothDayCountingMutation";
import type { SetBoothDayCountingMutation as MutationType } from "@api/mutations/__generated__/SetBoothDayCountingMutation.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { useAlertStore } from "@/store/alertStore";
import { countingBasisLine, fieldTotalNote, fieldTotalValue } from "./recapFieldTotals";

const SHOW_FIRST = 8;

type Props = { tenantId: string; startDate: string; endDate: string };

/** Staff-only switch for how this brand's recaps are counted. It changes the
 *  totals the client sees, so turning it on or off takes a second click. */
const CountingSwitch: React.FC<{
  tenantId: string;
  enabled: boolean;
  onChanged: () => void;
}> = ({ tenantId, enabled, onChanged }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, saving] = useMutation<MutationType>(SetBoothDayCountingMutation);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [enabled]);

  const set = (next: boolean) => {
    commit({
      variables: { input: { tenantId, enabled: next } },
      onCompleted: (res) => {
        const r = res.setBoothDayCounting;
        if (r?.success) {
          showAlert(r.message, "success");
          onChanged();
        } else {
          showAlert(r?.message || "Couldn't change how recaps are counted.", "error");
        }
        setConfirming(false);
      },
      onError: () => {
        showAlert("Couldn't change how recaps are counted.", "error");
        setConfirming(false);
      },
    });
  };

  const btn = {
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
  } as const;

  return (
    <div
      className="flex items-center justify-between gap-3 flex-wrap rounded-xl px-3 py-2 mb-3 print:hidden"
      style={{ border: "1px solid var(--spark-hairline)" }}
    >
      <p className="text-xs min-w-0" style={{ color: "var(--spark-text-meta)" }}>
        <span className="font-semibold" style={{ color: "var(--spark-text)" }}>
          Staff setting ·{" "}
        </span>
        {confirming
          ? enabled
            ? "Every recap will count again. The client's totals change right away."
            : "Recaps for the same store and day will count once. The client's totals change right away."
          : enabled
            ? "Counting one recap per store per day."
            : "Counting every recap. If several ambassadors file for the same booth on the same day, switch to one per store per day."}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => set(!enabled)}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={btn}
            >
              {enabled ? "Yes, count every recap" : "Yes, count once per store per day"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-xl text-sm"
              style={btn}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 rounded-xl text-sm"
            style={btn}
          >
            {enabled ? "Count every recap" : "Count once per store per day"}
          </button>
        )}
      </div>
    </div>
  );
};

const Body: React.FC<Props> = ({ tenantId, startDate, endDate }) => {
  const { isAdmin } = useSparkRole();
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    TenantRecapFieldTotalsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const sections = data.tenantRecapFieldTotals;
  const perStoreDay = Boolean(data.tenantBoothDayCounting);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <>
      <p className="text-sm mb-3" style={{ color: "var(--spark-text-meta)" }}>
        {countingBasisLine(perStoreDay)}
      </p>
      {isAdmin ? (
        <CountingSwitch
          tenantId={tenantId}
          enabled={perStoreDay}
          onChanged={() => setFetchKey((k) => k + 1)}
        />
      ) : null}
      {sections.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          No approved recaps with numbers in this range yet.
        </p>
      ) : (
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
                          {fieldTotalNote(f, perStoreDay)}
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
      )}
    </>
  );
};

/**
 * Everything the brand's approved recaps collected, totalled field by field
 * under the recap form's own sections (spark-api #1359). Brands whose booths
 * are staffed by more than one ambassador can be counted once per store per
 * day instead of once per recap (spark-api #1366).
 */
const RecapFieldTotalsSection: React.FC<Props> = (props) => (
  <div>
    <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
      All recap metrics
    </h3>
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
