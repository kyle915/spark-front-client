import React, { Suspense, useState } from "react";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import { providerSubmitUrl } from "@/utils/publicHosts";
import {
  formatHonestMoney,
  storeActionLabel,
  triggerExportDownload,
  type StoreActionTypeKind,
} from "./pilotHelpers";
import { PlanGateCallout } from "./PlanGateCallout";
import {
  PilotQueriesBuyerReportPageQuery,
  PilotQueriesExportBuyerReportQuery,
} from "@/api/queries/PilotQueries";
import {
  PilotMutationsReassignStoreActionMutation,
  PilotMutationsRespondStoreActionMutation,
  PilotMutationsVerifyRestockMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesBuyerReportPageQuery as BuyerQueryType } from "@/api/queries/__generated__/PilotQueriesBuyerReportPageQuery.graphql";
import type { PilotQueriesExportBuyerReportQuery as ExportQueryType } from "@/api/queries/__generated__/PilotQueriesExportBuyerReportQuery.graphql";
import type { PilotMutationsRespondStoreActionMutation as RespondActionType } from "@/api/mutations/__generated__/PilotMutationsRespondStoreActionMutation.graphql";
import type { PilotMutationsReassignStoreActionMutation as ReassignActionType } from "@/api/mutations/__generated__/PilotMutationsReassignStoreActionMutation.graphql";
import type { PilotMutationsVerifyRestockMutation as VerifyRestockType } from "@/api/mutations/__generated__/PilotMutationsVerifyRestockMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;
const OK_BANNER_STYLE = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

const BuyerReportBody: React.FC<{
  retailerFilter: string;
  setRetailerFilter: (v: string) => void;
  marketFilter: string;
  setMarketFilter: (v: string) => void;
  providerUuid: string;
  setProviderUuid: (v: string) => void;
  fetchKey: number;
  bump: () => void;
}> = ({
  retailerFilter,
  setRetailerFilter,
  marketFilter,
  setMarketFilter,
  providerUuid,
  setProviderUuid,
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<BuyerQueryType>(
    PilotQueriesBuyerReportPageQuery,
    {
      periodStart: null,
      periodEnd: null,
      retailerFilter: retailerFilter || null,
      marketFilter: marketFilter || null,
      providerUuid: providerUuid || null,
    },
    { fetchPolicy: "network-only", fetchKey },
  );
  const ws = data.workspaceOverview;
  const report = data.weeklyBuyerStoreReport;
  const actions = data.storeRecommendationActions;

  const [commitRespond] = useMutation<RespondActionType>(
    PilotMutationsRespondStoreActionMutation,
  );
  const [commitReassign] = useMutation<ReassignActionType>(
    PilotMutationsReassignStoreActionMutation,
  );
  const [commitVerify] = useMutation<VerifyRestockType>(
    PilotMutationsVerifyRestockMutation,
  );

  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [restockNoteByUuid, setRestockNoteByUuid] = useState<
    Record<string, string>
  >({});
  const [reassignProvByUuid, setReassignProvByUuid] = useState<
    Record<string, string>
  >({});
  const [banner, setBanner] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "xlsx") => {
    setExportingFormat(format);
    try {
      const res = await fetchQuery<ExportQueryType>(
        environment,
        PilotQueriesExportBuyerReportQuery,
        {
          format,
          periodStart: null,
          periodEnd: null,
          retailerFilter: retailerFilter || null,
          marketFilter: marketFilter || null,
          providerUuid: providerUuid || null,
        },
        { fetchPolicy: "network-only" },
      ).toPromise();
      if (res?.exportWeeklyBuyerReport) {
        triggerExportDownload(res.exportWeeklyBuyerReport);
      }
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Weekly Buyer & Budget-Meeting View · {ws.tenantName}
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Store Performance, Recommendations & Actions
          </h1>
          <p className="text-xs mt-1" style={META}>
            Period {report.periodStart} → {report.periodEnd} ·{" "}
            <strong className="mono">{report.totalVisits}</strong> visits ·
            Supported spend{" "}
            <strong className="mono">${report.totalSupportedCost}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exportingFormat !== null || report.planGated}
            onClick={() => void handleExport("csv")}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            style={FIELD_STYLE}
          >
            {exportingFormat === "csv" ? "Exporting…" : "↓ Export CSV"}
          </button>
          <button
            type="button"
            disabled={exportingFormat !== null || report.planGated}
            onClick={() => void handleExport("xlsx")}
            className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
            style={PRIMARY_BTN_STYLE}
          >
            {exportingFormat === "xlsx" ? "Building XLSX…" : "↓ Export Buyer XLSX"}
          </button>
        </div>
      </header>

      {report.planGated ? (
        <PlanGateCallout
          title="Weekly Buyer Store Report & Recommendation Actions"
          message={report.planUpgradeMessage}
          requiredPlan={report.requiredPlan}
        />
      ) : null}

      {banner && (
        <div
          className="p-3 rounded-xl text-xs"
          style={OK_BANNER_STYLE}
        >
          {banner}
        </div>
      )}

      {/* Filters */}
      <div className="spark-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <input
          value={retailerFilter}
          onChange={(e) => setRetailerFilter(e.target.value)}
          placeholder="Filter by retailer banner…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          placeholder="Filter by market / city / state…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <select
          value={providerUuid}
          onChange={(e) => setProviderUuid(e.target.value)}
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        >
          <option value="">All field providers</option>
          {ws.providers.map((p) => (
            <option key={p.uuid} value={p.uuid}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Store Table */}
      <section className="spark-card p-5 space-y-3">
        <h2 className="display text-lg font-bold">
          Store-by-Store Buyer Summary ({report.rows.length})
        </h2>
        {report.rows.length === 0 ? (
          <p className="text-xs" style={META}>
            No store visits or published recommendations in this period yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Store / Market</th>
                  <th className="py-2 pr-3">Providers</th>
                  <th className="py-2 pr-3">Visits</th>
                  <th className="py-2 pr-3">Supported Cost</th>
                  <th className="py-2 pr-3">Observed Units</th>
                  <th className="py-2 pr-3">Adjusted POS & Coverage</th>
                  <th className="py-2 pr-3">Published Recommendation</th>
                  <th className="py-2 text-right">Current Action</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr
                    key={r.storeKey}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold">{r.storeLabel}</div>
                      <div style={META}>
                        {r.retailerBanner} · {r.market || "—"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.providers.length > 0 ? r.providers.join(", ") : "—"}
                    </td>
                    <td className="py-2.5 pr-3 mono">{r.visitCount}</td>
                    <td className="py-2.5 pr-3 mono">
                      {formatHonestMoney(r.supportedBrandCost, {
                        isConfirmedZero: true,
                        incomplete: r.hasIncompleteCost,
                      })}
                    </td>
                    <td className="py-2.5 pr-3 mono">{r.repObservedUnits}</td>
                    <td className="py-2.5 pr-3 mono">
                      <div>
                        {r.adjustedRegisterUnits != null
                          ? `${r.adjustedRegisterUnits} units`
                          : "—"}
                      </div>
                      <div className="text-[11px]" style={META}>
                        {r.posCoverageLabel}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 max-w-xs">
                      {r.recommendationSummary ?? (
                        <span style={META}>None published</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {r.currentActionType ? (
                        <div>
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={OK_BANNER_STYLE}
                          >
                            {storeActionLabel(
                              r.currentActionType as StoreActionTypeKind,
                            )}{" "}
                            · {r.currentActionStatus}
                          </span>
                          <div className="text-[11px] mt-0.5" style={META}>
                            {r.currentActionProvider ??
                              r.currentActionOwner ??
                              ""}
                          </div>
                        </div>
                      ) : (
                        <span style={META}>No action yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Active Recommendation Actions Lifecycle */}
      <section className="spark-card p-5 space-y-3">
        <h2 className="display text-lg font-bold">
          Recommendation Action Decisions & Closed-Loop Verification ({actions.length})
        </h2>
        {actions.length === 0 ? (
          <p className="text-xs" style={META}>
            Act on a published store recommendation from Dashboard ("Where to go next") to create a tracked Rebook, Hold, or Restock decision.
          </p>
        ) : (
          <div className="space-y-3">
            {actions.map((act) => (
              <div
                key={act.uuid}
                className="p-4 rounded-2xl space-y-2 text-xs"
                style={BORDER}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span
                      className="px-2.5 py-0.5 rounded-full font-bold mr-2"
                      style={OK_BANNER_STYLE}
                    >
                      {storeActionLabel(act.actionType as StoreActionTypeKind)}
                    </span>
                    <strong className="text-sm">{act.storeLabel}</strong>
                    <span className="ml-2 mono" style={META}>
                      {act.status} · {act.findingId}
                    </span>
                  </div>
                  {act.submissionCode && (
                    <a
                      href={providerSubmitUrl(act.submissionCode)}
                      target="_blank"
                      rel="noreferrer"
                      className="mono underline font-semibold"
                      style={{ color: "var(--spark-ok-ink)" }}
                    >
                      Field link {act.submissionCode}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-4" style={META}>
                  {act.providerName && (
                    <span>
                      Provider: <strong>{act.providerName}</strong> (
                      {act.providerResponseStatus || "pending"})
                      {act.previousProviderName
                        ? ` · previously ${act.previousProviderName}`
                        : ""}
                    </span>
                  )}
                  {act.ownerEmail && (
                    <span>
                      Owner: <strong className="mono">{act.ownerEmail}</strong>
                    </span>
                  )}
                  {act.targetDate && <span>Target: {act.targetDate}</span>}
                  {act.holdReason && <span>Hold reason: {act.holdReason}</span>}
                  {act.nextReviewDate && (
                    <span>Next review: {act.nextReviewDate}</span>
                  )}
                </div>

                {/* Provider Accept/Decline */}
                {ws.viewerProviderUuid &&
                  ws.viewerProviderUuid === act.providerUuid &&
                  act.providerResponseStatus === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          commitRespond({
                            variables: {
                              actionUuid: act.uuid,
                              decision: "accept",
                              note: "Confirmed crew availability",
                            },
                            onCompleted: () => bump(),
                          })
                        }
                        className="px-3 py-1 rounded-lg font-bold"
                        style={PRIMARY_BTN_STYLE}
                      >
                        Accept Rebook
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          commitRespond({
                            variables: {
                              actionUuid: act.uuid,
                              decision: "decline",
                              note: "No rep available in market",
                            },
                            onCompleted: () => bump(),
                          })
                        }
                        className="px-3 py-1 rounded-lg font-semibold"
                        style={{
                          color: "var(--spark-flag-ink, #a8340f)",
                          ...BORDER,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                {/* Brand Reassign Provider */}
                {ws.canApproveSpend &&
                  act.actionType === "rebook" &&
                  act.status !== "completed" &&
                  ws.providers.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        value={reassignProvByUuid[act.uuid] ?? ""}
                        onChange={(e) =>
                          setReassignProvByUuid((p) => ({
                            ...p,
                            [act.uuid]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg"
                        style={FIELD_STYLE}
                      >
                        <option value="">Reassign agency…</option>
                        {ws.providers.map((p) => (
                          <option key={p.uuid} value={p.uuid}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const nextP = reassignProvByUuid[act.uuid];
                          if (!nextP) return;
                          commitReassign({
                            variables: {
                              actionUuid: act.uuid,
                              newProviderUuid: nextP,
                              note: "Reassigned from Buyer Report",
                            },
                            onCompleted: () => {
                              setBanner(
                                "Reassigned provider while preserving full decision history.",
                              );
                              bump();
                            },
                          });
                        }}
                        className="px-3 py-1 rounded-lg font-semibold"
                        style={FIELD_STYLE}
                      >
                        Reassign
                      </button>
                    </div>
                  )}

                {/* Restock Verification */}
                {act.actionType === "restock" &&
                  act.status !== "completed" &&
                  ws.canEditBrandOps && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        value={restockNoteByUuid[act.uuid] ?? ""}
                        onChange={(e) =>
                          setRestockNoteByUuid((p) => ({
                            ...p,
                            [act.uuid]: e.target.value,
                          }))
                        }
                        placeholder="Verify restock note (e.g. grocery manager confirmed 6 cases stocked)…"
                        className="flex-1 min-w-[240px] px-3 py-1.5 rounded-lg"
                        style={FIELD_STYLE}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const note = (
                            restockNoteByUuid[act.uuid] ?? ""
                          ).trim();
                          if (!note) return;
                          commitVerify({
                            variables: {
                              actionUuid: act.uuid,
                              verificationMethod: "note",
                              verificationNote: note,
                              followupVisitUuid: null,
                            },
                            onCompleted: () => {
                              setBanner("Verified store restock.");
                              bump();
                            },
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg font-bold"
                        style={PRIMARY_BTN_STYLE}
                      >
                        Verify Restock
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const BuyerReportPage: React.FC = () => {
  const [retailerFilter, setRetailerFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [providerUuid, setProviderUuid] = useState("");
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="p-4 lg:p-8">
      <Suspense fallback={<p className="text-sm mono">Loading buyer report…</p>}>
        <BuyerReportBody
          retailerFilter={retailerFilter}
          setRetailerFilter={setRetailerFilter}
          marketFilter={marketFilter}
          setMarketFilter={setMarketFilter}
          providerUuid={providerUuid}
          setProviderUuid={setProviderUuid}
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default BuyerReportPage;
