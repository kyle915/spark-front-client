import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { EventMileageSummaryQuery } from "@/api/queries/EventMileageSummaryQuery";
import type { EventMileageSummaryQuery as EventMileageSummaryQueryType } from "@api/queries/__generated__/EventMileageSummaryQuery.graphql";
import { SetEventMileageTrackingMutation } from "@/api/mutations/SetEventMileageTrackingMutation";
import type { SetEventMileageTrackingMutation as SetEventMileageTrackingMutationType } from "@api/mutations/__generated__/SetEventMileageTrackingMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Admin GPS mileage panel for a gig. Enable tracking + set the $/mile
 * reimbursement rate (the BA then gets a Start/Stop control on the mobile
 * shift screen), and review every BA's logged trip with total miles + $.
 *
 * Sits beside EventAttendanceTable on /request/view + the Event detail page.
 * Renders nothing for non-admins (the server returns null) so it stays out of
 * the client-facing surfaces.
 */

const money = (v: number | null | undefined): string =>
  v == null ? "$0.00" : `$${v.toFixed(2)}`;
const miles = (v: number | null | undefined): string =>
  v == null ? "0.0" : v.toFixed(1);

const Inner: React.FC<{ eventUuid: string }> = ({ eventUuid }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  // Bump on save so the summary (rate / config / sessions) re-syncs with the
  // server's resolved state without a manual reload. store-and-network keeps
  // the cached data on screen while it revalidates, so there's no flash.
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<EventMileageSummaryQueryType>(
    EventMileageSummaryQuery,
    { eventId: eventUuid },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const summary = data.eventMileageSummary;
  const [commit, saving] = useMutation<SetEventMileageTrackingMutationType>(
    SetEventMileageTrackingMutation,
  );

  // Local source of truth for the toggle + rate, seeded from the server.
  const [enabled, setEnabled] = useState<boolean>(!!summary?.trackMileage);
  const [rate, setRate] = useState<string>(
    summary?.mileageRate != null ? String(summary.mileageRate) : "0.725",
  );

  // Non-admins (or an unresolved event) get null — render nothing so this
  // never appears on the client view.
  if (!summary) return null;

  const save = (nextEnabled: boolean) => {
    const rateNum = parseFloat(rate);
    if (nextEnabled && (!Number.isFinite(rateNum) || rateNum < 0)) {
      showAlert("Enter a valid $/mile rate first.", "error");
      return;
    }
    commit({
      variables: {
        eventId: eventUuid,
        trackMileage: nextEnabled,
        mileageRate: nextEnabled ? rateNum : null,
      },
      onCompleted: (res) => {
        const r = res?.setEventMileageTracking;
        if (!r?.success) {
          showAlert(r?.message ?? "Couldn't update mileage tracking.", "error");
          return;
        }
        setEnabled(nextEnabled);
        setFetchKey((k) => k + 1);
        showAlert(r.message, "success");
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const sessions = summary.sessions ?? [];

  return (
    <div className="spark-card p-5">
      <p
        className="mono text-[10px] mb-3"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        MILEAGE REIMBURSEMENT
      </p>

      {/* Enable toggle + rate */}
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <button
          type="button"
          onClick={() => save(!enabled)}
          disabled={saving}
          className="px-3 py-1.5 rounded-md text-xs font-semibold transition"
          style={{
            background: enabled ? "var(--spark-lime, #c5f546)" : "transparent",
            color: enabled ? "#0a0d09" : "rgba(255,255,255,0.7)",
            border: enabled
              ? "1px solid var(--spark-lime, #c5f546)"
              : "1px solid rgba(255,255,255,0.2)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {enabled ? "● Tracking on" : "○ Tracking off"}
        </button>

        <div className="flex items-center gap-1.5">
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.005"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-20 px-2 py-1 rounded-md text-xs"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
            / mile
          </span>
          {enabled && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="ml-1 px-2.5 py-1 rounded-md text-xs"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff",
                opacity: saving ? 0.6 : 1,
              }}
            >
              Save rate
            </button>
          )}
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
        {enabled
          ? "Assigned BAs see a Start/Stop mileage control on the mobile shift screen."
          : "Turn on to let BAs track reimbursable mileage for this gig."}
      </p>

      {/* Per-BA trip table */}
      {sessions.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table
            className="w-full text-xs"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{
                  color: "rgba(255,255,255,0.5)",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <th className="text-left py-2 pr-3 font-normal">Ambassador</th>
                <th className="text-left py-2 pr-3 font-normal">Status</th>
                <th className="text-right py-2 pr-3 font-normal">Miles</th>
                <th className="text-right py-2 font-normal">Reimbursement</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.uuid}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td className="py-2 pr-3 font-semibold">
                    {s.ambassadorName ?? "—"}
                  </td>
                  <td
                    className="py-2 pr-3"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {s.status === "active" ? "In progress" : "Completed"}
                  </td>
                  <td className="py-2 pr-3 text-right">{miles(s.totalMiles)}</td>
                  <td
                    className="py-2 text-right mono"
                    style={{ color: "var(--spark-lime, #c5f546)" }}
                  >
                    {money(s.reimbursementAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                <td
                  className="py-2 pr-3 font-semibold"
                  colSpan={2}
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Total · {summary.sessionCount} trip
                  {summary.sessionCount === 1 ? "" : "s"}
                </td>
                <td className="py-2 pr-3 text-right font-semibold">
                  {miles(summary.totalMiles)}
                </td>
                <td
                  className="py-2 text-right mono font-semibold"
                  style={{ color: "var(--spark-lime, #c5f546)" }}
                >
                  {money(summary.totalReimbursement)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {enabled && sessions.length === 0 && (
        <p
          className="mt-4"
          style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}
        >
          No trips logged yet.
        </p>
      )}
    </div>
  );
};

// Suspense-isolated like the attendance table so a slow fetch can't block the
// page; null result (non-admin / unresolved event) renders nothing.
const EventMileagePanel: React.FC<{ eventUuid: string }> = ({ eventUuid }) => {
  if (!eventUuid) return null;
  return (
    <Suspense fallback={null}>
      <Inner eventUuid={eventUuid} />
    </Suspense>
  );
};

export default EventMileagePanel;
