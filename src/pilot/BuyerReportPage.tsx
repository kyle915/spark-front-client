import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
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
  PilotMutationsSetBuyerDigestMutation,
  PilotMutationsVerifyRestockMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesBuyerReportPageQuery as BuyerQueryType } from "@/api/queries/__generated__/PilotQueriesBuyerReportPageQuery.graphql";
import type { PilotQueriesExportBuyerReportQuery as ExportQueryType } from "@/api/queries/__generated__/PilotQueriesExportBuyerReportQuery.graphql";
import type { PilotMutationsRespondStoreActionMutation as RespondActionType } from "@/api/mutations/__generated__/PilotMutationsRespondStoreActionMutation.graphql";
import type { PilotMutationsReassignStoreActionMutation as ReassignActionType } from "@/api/mutations/__generated__/PilotMutationsReassignStoreActionMutation.graphql";
import type { PilotMutationsVerifyRestockMutation as VerifyRestockType } from "@/api/mutations/__generated__/PilotMutationsVerifyRestockMutation.graphql";
import type { PilotMutationsSetBuyerDigestMutation as SetBuyerDigestType } from "@/api/mutations/__generated__/PilotMutationsSetBuyerDigestMutation.graphql";
import { Download } from "lucide-react";
import { BuyerPitchDeckShareCard } from "./BuyerPitchDeckShareCard";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { REPORTS_HUB_TABS, STORE_BUYER_SUBTABS } from "@/shared/sparkHubNav";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import PilotPeriodBar from "./PilotPeriodBar";
import { resolvePilotPeriod, type PilotRangeKey } from "./pilotPeriodFilter";

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
  periodStart: string | null;
  periodEnd: string | null;
  periodControls: React.ReactNode;
  retailerFilter: string;
  setRetailerFilter: (v: string) => void;
  marketFilter: string;
  setMarketFilter: (v: string) => void;
  providerUuid: string;
  setProviderUuid: (v: string) => void;
  fetchKey: number;
  bump: () => void;
}> = ({
  periodStart,
  periodEnd,
  periodControls,
  retailerFilter,
  setRetailerFilter,
  marketFilter,
  setMarketFilter,
  providerUuid,
  setProviderUuid,
  fetchKey,
  bump,
}) => {
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
  const data = useLazyLoadQuery<BuyerQueryType>(
    PilotQueriesBuyerReportPageQuery,
    {
      periodStart,
      periodEnd,
      retailerFilter: retailerFilter || null,
      marketFilter: marketFilter || null,
      providerUuid: providerUuid || null,
    },
    { fetchPolicy: "store-and-network", fetchKey },
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
  const [commitDigest, savingDigest] = useMutation<SetBuyerDigestType>(
    PilotMutationsSetBuyerDigestMutation,
  );

  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [restockNoteByUuid, setRestockNoteByUuid] = useState<
    Record<string, string>
  >({});
  const [reassignProvByUuid, setReassignProvByUuid] = useState<
    Record<string, string>
  >({});
  const [banner, setBanner] = useState<string | null>(null);
  const [digestEnabled, setDigestEnabled] = useState(
    ws.buyerWeeklyDigestEnabled,
  );
  const [digestEmails, setDigestEmails] = useState(
    ws.buyerDigestRecipientEmails || "",
  );

  const handleExport = async (format: "csv" | "xlsx") => {
    setExportingFormat(format);
    try {
      const res = await fetchQuery<ExportQueryType>(
        environment,
        PilotQueriesExportBuyerReportQuery,
        {
          format,
          periodStart,
          periodEnd,
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

  const retailerBanners = useMemo(() => {
    const seen = new Set<string>();
    for (const r of report.rows) {
      const b = (r.retailerBanner || "").trim();
      if (b) seen.add(b);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [report.rows]);

  const reportMarkets = useMemo(() => {
    const seen = new Set<string>();
    for (const r of report.rows) {
      const m = (r.market || "").trim();
      if (m) seen.add(m);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [report.rows]);

  return (
    <div className="space-y-6 max-w-7xl">
      <SparkPageHeader
        eyebrow={`Weekly buyer & budget view · ${ws.tenantName}`}
        title="Store performance, recommendations & actions"
        support={
          <span className="tab-num">
            Period {report.periodStart} → {report.periodEnd} ·{" "}
            <strong>{report.totalVisits}</strong> visits · Supported spend{" "}
            <strong>${report.totalSupportedCost}</strong>
          </span>
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={exportingFormat !== null || report.planGated}
              onClick={() => void handleExport("csv")}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              style={FIELD_STYLE}
            >
              <Download size={14} strokeWidth={1.75} />
              {exportingFormat === "csv" ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null || report.planGated}
              onClick={() => void handleExport("xlsx")}
              className="px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              style={PRIMARY_BTN_STYLE}
            >
              <Download size={14} strokeWidth={1.75} />
              {exportingFormat === "xlsx" ? "Building XLSX…" : "Export Buyer XLSX"}
            </button>
          </div>
        }
      />

      {report.planGated ? (
        <PlanGateCallout
          title="Weekly Buyer Store Report & Recommendation Actions"
          message={report.planUpgradeMessage}
          requiredPlan={report.requiredPlan}
        />
      ) : null}

      {banner && (
        <div
          className="p-3 rounded-lg text-xs font-medium"
          style={OK_BANNER_STYLE}
        >
          {banner}
        </div>
      )}

      {/* Period & Filters */}
      <div className="spark-card p-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium" style={META}>
            Date window & store filters
          </span>
          {periodControls}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={retailerFilter}
            onChange={(e) => setRetailerFilter(e.target.value)}
            placeholder="Filter by retailer banner…"
            className="px-3 py-2 rounded-lg"
            style={FIELD_STYLE}
          />
          <input
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            placeholder="Filter by market / city / state…"
            className="px-3 py-2 rounded-lg"
            style={FIELD_STYLE}
          />
          <select
            value={providerUuid}
            onChange={(e) => setProviderUuid(e.target.value)}
            className="px-3 py-2 rounded-lg"
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
      </div>

      <BuyerPitchDeckShareCard
        brandName={ws.tenantName}
        periodStart={periodStart ?? report.periodStart}
        periodEnd={periodEnd ?? report.periodEnd}
        retailerFilter={retailerFilter}
        onRetailerFilterChange={setRetailerFilter}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
        providerUuid={providerUuid}
        retailerBanners={retailerBanners}
        markets={reportMarkets}
      />

      {(ws.canManagePos || ws.isBrandAdmin) && (
        <section className="spark-card p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="display text-base font-bold">
                Monday weekly buyer digest
              </h2>
              <p className="text-xs mt-1" style={META}>
                Opt-in email with this store table attached as CSV. Separate from
                the field-marketing client weekly digest.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={digestEnabled}
              disabled={savingDigest}
              onClick={() => {
                const next = !digestEnabled;
                commitDigest({
                  variables: {
                    enabled: next,
                    recipientEmails: digestEmails.trim() || null,
                  },
                  onCompleted: (r) => {
                    if (r.setBuyerWeeklyDigest.ok) {
                      setDigestEnabled(next);
                      setBanner(
                        next
                          ? "Weekly buyer digest enabled for Monday mornings."
                          : "Weekly buyer digest turned off.",
                      );
                      bump();
                    } else {
                      setBanner(
                        r.setBuyerWeeklyDigest.error ??
                          "Could not update buyer digest.",
                      );
                    }
                  },
                });
              }}
              className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
              style={{
                background: digestEnabled
                  ? "var(--spark-ok-ink)"
                  : "var(--spark-border)",
              }}
            >
              <span
                className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
                style={{
                  transform: digestEnabled
                    ? "translateX(1.4rem)"
                    : "translateX(0.2rem)",
                }}
              />
            </button>
          </div>
          <label className="block text-xs space-y-1">
            <span style={META}>
              Recipients (optional override — blank uses brand admins + finance
              reviewers)
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                value={digestEmails}
                onChange={(e) => setDigestEmails(e.target.value)}
                placeholder="buyer@brand.com, finance@brand.com"
                className="flex-1 min-w-[16rem] px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              />
              <button
                type="button"
                disabled={savingDigest}
                onClick={() => {
                  commitDigest({
                    variables: {
                      enabled: digestEnabled,
                      recipientEmails: digestEmails.trim(),
                    },
                    onCompleted: (r) => {
                      if (r.setBuyerWeeklyDigest.ok) {
                        setBanner("Saved buyer digest recipients.");
                        bump();
                      } else {
                        setBanner(
                          r.setBuyerWeeklyDigest.error ??
                            "Could not save recipients.",
                        );
                      }
                    },
                  });
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold"
                style={FIELD_STYLE}
              >
                Save recipients
              </button>
            </div>
          </label>
        </section>
      )}

      {/* Store Table */}
      <section className="spark-card p-5 space-y-3">
        <h2 className="display text-lg font-bold tab-num">
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
                      <button
                        type="button"
                        onClick={() =>
                          openStoreSheet({
                            storeKey: r.storeKey,
                            storeName: r.storeLabel,
                            fallbackTitle: r.storeLabel,
                          })
                        }
                        className="font-semibold text-left hover:underline cursor-pointer"
                        style={{ color: "var(--spark-text)" }}
                      >
                        {r.storeLabel}
                      </button>
                      <div style={META}>
                        {r.retailerBanner} · {r.market || "—"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.providers.length > 0 ? r.providers.join(", ") : "—"}
                    </td>
                    <td className="py-2.5 pr-3 tab-num">{r.visitCount}</td>
                    <td className="py-2.5 pr-3 tab-num">
                      {formatHonestMoney(r.supportedBrandCost, {
                        isConfirmedZero: true,
                        incomplete: r.hasIncompleteCost,
                      })}
                    </td>
                    <td className="py-2.5 pr-3 tab-num">{r.repObservedUnits}</td>
                    <td className="py-2.5 pr-3 tab-num">
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
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
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
        <h2 className="display text-lg font-bold tab-num">
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
                className="p-4 rounded-xl space-y-2 text-xs"
                style={BORDER}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span
                      className="px-2.5 py-0.5 rounded-md font-bold mr-2"
                      style={OK_BANNER_STYLE}
                    >
                      {storeActionLabel(act.actionType as StoreActionTypeKind)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        openStoreSheet({
                          storeKey: act.storeKey,
                          storeName: act.storeLabel,
                          fallbackTitle: act.storeLabel,
                        })
                      }
                      className="font-bold text-sm hover:underline cursor-pointer"
                      style={{ color: "var(--spark-text)" }}
                    >
                      {act.storeLabel}
                    </button>
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
                  {act.targetDate && <span className="tab-num">Target: {act.targetDate}</span>}
                  {act.holdReason && <span>Hold reason: {act.holdReason}</span>}
                  {act.nextReviewDate && (
                    <span className="tab-num">Next review: {act.nextReviewDate}</span>
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
  const tenantId = useAuthStore((s) => s.tenantId);
  const [searchParams] = useSearchParams();
  const [range, setRange] = useState<PilotRangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [retailerFilter, setRetailerFilter] = useState(
    () => searchParams.get("retailer") ?? "",
  );
  const [marketFilter, setMarketFilter] = useState(
    () => searchParams.get("market") ?? "",
  );
  const [providerUuid, setProviderUuid] = useState("");
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (searchParams.get("deck") === "1") {
      const el = document.getElementById("buyer-deck-builder");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  const { periodStart, periodEnd } = useMemo(
    () => resolvePilotPeriod(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  return (
    <div className="space-y-5 max-w-7xl spark-scale">
      <div className="flex flex-wrap items-center gap-2">
        <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
        <SparkHubTabs tabs={STORE_BUYER_SUBTABS} ariaLabel="Store & buyer views" />
      </div>
      <Suspense fallback={<p className="text-sm" style={META}>Loading buyer report…</p>}>
        <BuyerReportBody
          key={tenantId ?? "none"}
          periodStart={periodStart}
          periodEnd={periodEnd}
          periodControls={
            <PilotPeriodBar
              range={range}
              onRangeChange={setRange}
              customStart={customStart}
              onCustomStartChange={setCustomStart}
              customEnd={customEnd}
              onCustomEndChange={setCustomEnd}
              ariaLabel="Buyer report date window"
            />
          }
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
