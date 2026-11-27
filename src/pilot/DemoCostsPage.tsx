import React, { Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  evidenceBadgeMeta,
  formatHonestMoney,
  settlementBadgeMeta,
  type CostEvidenceKind,
  type CostSettlementKind,
} from "./pilotHelpers";
import { ArrowUpRight } from "lucide-react";
import { PlanGateCallout } from "./PlanGateCallout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { BUDGET_PNL_SUBTABS, REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { useAuthStore } from "@/store/authStore";
import PilotPeriodBar from "./PilotPeriodBar";
import { resolvePilotPeriod, type PilotRangeKey } from "./pilotPeriodFilter";
import { PilotQueriesDemoCostsPageQuery } from "@/api/queries/PilotQueries";
import {
  PilotMutationsUpsertAgreementMutation,
  PilotMutationsUpsertCostLineMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesDemoCostsPageQuery as CostsQueryType } from "@/api/queries/__generated__/PilotQueriesDemoCostsPageQuery.graphql";
import type { PilotMutationsUpsertAgreementMutation as AgreementMutationType } from "@/api/mutations/__generated__/PilotMutationsUpsertAgreementMutation.graphql";
import type { PilotMutationsUpsertCostLineMutation as CostLineMutationType } from "@/api/mutations/__generated__/PilotMutationsUpsertCostLineMutation.graphql";

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

const FEE_BASE_OPTIONS = [
  { key: "product", label: "Product purchases" },
  { key: "demo_fee", label: "Demo fee" },
  { key: "supplies", label: "Supplies" },
  { key: "travel_parking_tolls", label: "Travel / parking" },
] as const;

const GROUP_BY_LABELS: Record<string, string> = {
  store: "Store",
  program: "Program",
  provider: "Provider",
  month: "Month",
};

const DemoCostsBody: React.FC<{
  groupBy: string;
  setGroupBy: (g: string) => void;
  periodStart: string | null;
  periodEnd: string | null;
  periodControls: React.ReactNode;
  fetchKey: number;
  bump: () => void;
}> = ({
  groupBy,
  setGroupBy,
  periodStart,
  periodEnd,
  periodControls,
  fetchKey,
  bump,
}) => {
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
  const data = useLazyLoadQuery<CostsQueryType>(
    PilotQueriesDemoCostsPageQuery,
    {
      groupBy,
      periodStart,
      periodEnd,
      providerUuid: null,
    },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const ws = data.workspaceOverview;
  const dash = data.brandCostDashboard;
  const visits = data.canonicalVisits;

  const [commitAgreement, savingAgreement] = useMutation<AgreementMutationType>(
    PilotMutationsUpsertAgreementMutation,
  );
  const [commitCostLine, savingLine] = useMutation<CostLineMutationType>(
    PilotMutationsUpsertCostLineMutation,
  );

  const [agProviderUuid, setAgProviderUuid] = useState(
    ws.providers[0]?.uuid ?? "",
  );
  const [agName, setAgName] = useState("Standard Retail Rate Card");
  const [agDemoFee, setAgDemoFee] = useState("225.00");
  const [agAdminPct, setAgAdminPct] = useState("10.00");
  const [agBases, setAgBases] = useState<string[]>(["product"]);

  const [lineVisitUuid, setLineVisitUuid] = useState(visits[0]?.uuid ?? "");
  const [lineCat, setLineCat] = useState("demo_fee");
  const [lineAmount, setLineAmount] = useState("");
  const [lineSettlement, setLineSettlement] = useState("invoiced");
  const [lineDesc, setLineDesc] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const toggleFeeBase = (base: string) => {
    setAgBases((prev) =>
      prev.includes(base) ? prev.filter((b) => b !== base) : [...prev, base],
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <SparkPageHeader
        eyebrow="Brand-visible economics · Never exposes worker pay"
        title="Actual cost per demo & rollups"
        support="Unknown rates stay explicitly marked Unknown (never $0.00). Efficiency metrics withhold until proof and rates are complete."
        action={
          <Link
            to="/finance-queue"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            style={{
              background: "rgba(239,90,42,0.12)",
              color: "var(--spark-flag-ink, #ef5a2a)",
              border: "1px solid rgba(239,90,42,0.4)",
            }}
          >
            Finance exception queue
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </Link>
        }
      />

      {dash.planGated ? (
        <PlanGateCallout
          title="Actual Demo Costs & Rate Card Reconciliation"
          message={dash.planUpgradeMessage}
          requiredPlan={dash.requiredPlan}
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

      {/* Rollup Table */}
      <section className="spark-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-lg font-bold">Cost Rollups</h2>
          <div className="flex flex-wrap items-center gap-2">
            {periodControls}
            <div className="pill-group" role="group" aria-label="Group demo costs by">
              {(["store", "program", "provider", "month"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`pill-btn capitalize ${groupBy === g ? "on" : ""}`}
                >
                  By {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {dash.rollups.length === 0 ? (
          <p className="text-xs" style={META}>
            No canonical visits in range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">
                    {GROUP_BY_LABELS[groupBy] ?? groupBy}
                  </th>
                  <th className="py-2 pr-3">Visits (Complete / Incomplete)</th>
                  <th className="py-2 pr-3">Total Brand Cost</th>
                  <th className="py-2 pr-3">Supported Cost</th>
                  <th className="py-2 pr-3">Invoiced / Paid</th>
                  <th className="py-2 pr-3">Cost / Sample</th>
                  <th className="py-2 text-right">Cost / Observed Unit</th>
                </tr>
              </thead>
              <tbody>
                {dash.rollups.map((r) => (
                  <tr
                    key={r.key}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2.5 pr-3 font-semibold">
                      {groupBy === "store" ? (
                        <button
                          type="button"
                          onClick={() =>
                            openStoreSheet({
                              storeKey: r.key,
                              storeName: r.label,
                              fallbackTitle: r.label,
                            })
                          }
                          className="font-semibold text-left hover:underline cursor-pointer"
                          style={{ color: "var(--spark-text)" }}
                        >
                          {r.label}
                        </button>
                      ) : (
                        r.label
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tab-num">
                      {r.visitCount} ({r.completeVisitCount} ok /{" "}
                      {r.incompleteVisitCount} inc)
                    </td>
                    <td className="py-2.5 pr-3 tab-num font-semibold">
                      {r.totalCost != null
                        ? formatHonestMoney(r.totalCost, {
                            isConfirmedZero: true,
                          })
                        : `${formatHonestMoney(r.knownTotalCost, { isConfirmedZero: true })} + Unknown`}
                    </td>
                    <td
                      className="py-2.5 pr-3 tab-num font-semibold"
                      style={{ color: "var(--spark-ok-ink)" }}
                    >
                      {formatHonestMoney(r.supportedCost, {
                        isConfirmedZero: true,
                      })}
                    </td>
                    <td className="py-2.5 pr-3 tab-num" style={META}>
                      ${r.invoicedCost} / ${r.paidCost}
                    </td>
                    <td className="py-2.5 pr-3 tab-num">
                      {r.costPerSample ? `$${r.costPerSample}` : "Withheld"}
                    </td>
                    <td className="py-2.5 text-right tab-num">
                      {r.costPerObservedUnit
                        ? `$${r.costPerObservedUnit}`
                        : "Withheld"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Finance Controls: Rate Agreement + Add Visit Cost Line */}
      {ws.canEditFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            className="spark-card p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!agProviderUuid) return;
              commitAgreement({
                variables: {
                  providerUuid: agProviderUuid,
                  name: agName.trim(),
                  contractedDemoFee: agDemoFee.trim() || null,
                  includedHours: "4.00",
                  extraHourRate: "45.00",
                  mileageRate: "0.67",
                  adminFeePercent: agAdminPct.trim() || "0.00",
                  adminFeeBases: agBases,
                  taxPercent: "0.00",
                },
                onCompleted: (r) => {
                  if (r.upsertProviderAgreement.ok) {
                    setBanner("Saved provider rate card & admin fee base rules.");
                    bump();
                  } else {
                    setBanner(r.upsertProviderAgreement.error ?? "Save failed.");
                  }
                },
              });
            }}
          >
            <h2 className="display text-base font-bold">
              Provider Rate Card & Fee Base Rules
            </h2>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <select
                required
                value={agProviderUuid}
                onChange={(e) => setAgProviderUuid(e.target.value)}
                className="px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              >
                <option value="">Select agency…</option>
                {ws.providers.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={agName}
                onChange={(e) => setAgName(e.target.value)}
                placeholder="Agreement name"
                className="px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              />
              <label className="space-y-1">
                <span style={META}>Contracted Demo Fee ($)</span>
                <input
                  value={agDemoFee}
                  onChange={(e) => setAgDemoFee(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg tab-num"
                  style={FIELD_STYLE}
                />
              </label>
              <label className="space-y-1">
                <span style={META}>Admin / Service Fee (%)</span>
                <input
                  value={agAdminPct}
                  onChange={(e) => setAgAdminPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg tab-num"
                  style={FIELD_STYLE}
                />
              </label>
            </div>
            <div className="text-xs space-y-1">
              <span style={META}>Apply Admin Fee ONLY to Selected Bases:</span>
              <div className="flex flex-wrap gap-3 pt-1">
                {FEE_BASE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={agBases.includes(opt.key)}
                      onChange={() => toggleFeeBase(opt.key)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={savingAgreement}
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={PRIMARY_BTN_STYLE}
            >
              Save Agreement Rules
            </button>
          </form>

          <form
            className="spark-card p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lineVisitUuid) return;
              const trimmedAmt = lineAmount.trim();
              commitCostLine({
                variables: {
                  visitUuid: lineVisitUuid,
                  category: lineCat,
                  sourceType: "invoice_line",
                  amount: trimmedAmt || null,
                  isConfirmedZero: trimmedAmt === "0" || trimmedAmt === "0.00",
                  description: lineDesc.trim(),
                  settlementStatus: lineSettlement,
                  evidenceStatus: null,
                  providerUuid: null,
                },
                onCompleted: (r) => {
                  if (r.upsertBrandCostLine.ok) {
                    setLineAmount("");
                    setLineDesc("");
                    setBanner("Recorded cost line & recomputed visit summary.");
                    bump();
                  } else {
                    setBanner(r.upsertBrandCostLine.error ?? "Failed to save cost line.");
                  }
                },
              });
            }}
          >
            <h2 className="display text-base font-bold">
              Record Brand Cost Line on Visit
            </h2>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <select
                required
                value={lineVisitUuid}
                onChange={(e) => setLineVisitUuid(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              >
                <option value="">Select visit…</option>
                {visits.map((v) => (
                  <option key={v.uuid} value={v.uuid}>
                    {v.storeLabel} · {v.visitDate} ({v.shiftKey})
                  </option>
                ))}
              </select>
              <select
                value={lineCat}
                onChange={(e) => setLineCat(e.target.value)}
                className="px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              >
                <option value="demo_fee">Demo fee</option>
                <option value="extra_hours">Extra hours</option>
                <option value="product">Product purchase</option>
                <option value="supplies">Supplies</option>
                <option value="travel_parking_tolls">Parking / tolls</option>
                <option value="mileage">Mileage</option>
                <option value="credit_deduction">Credit / deduction (-)</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={lineAmount}
                onChange={(e) => setLineAmount(e.target.value)}
                placeholder="Amount $ (leave blank if unknown)"
                className="px-3 py-2 rounded-lg tab-num"
                style={FIELD_STYLE}
              />
              <select
                value={lineSettlement}
                onChange={(e) => setLineSettlement(e.target.value)}
                className="px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              >
                <option value="estimated">Estimated</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
              </select>
              <input
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                placeholder="Invoice # or note"
                className="px-3 py-2 rounded-lg"
                style={FIELD_STYLE}
              />
            </div>
            <button
              type="submit"
              disabled={savingLine}
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={PRIMARY_BTN_STYLE}
            >
              + Add Cost Line
            </button>
          </form>
        </div>
      )}

      {/* Per-Visit Breakdown */}
      <section className="spark-card p-5 space-y-4">
        <h2 className="display text-lg font-bold tab-num">
          Visit-Level Cost Breakdown ({visits.length})
        </h2>
        <div className="space-y-3">
          {visits.map((v) => {
            const setMeta = settlementBadgeMeta(
              (v.settlementStatus as CostSettlementKind) || "estimated",
            );
            const evMeta = evidenceBadgeMeta(
              (v.evidenceStatus as CostEvidenceKind) || "missing",
            );
            return (
              <div key={v.uuid} className="p-4 rounded-xl space-y-2" style={BORDER}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        openStoreSheet({
                          storeKey: v.storeKey,
                          storeName: v.storeLabel,
                          fallbackTitle: v.storeLabel,
                        })
                      }
                      className="font-bold text-sm hover:underline cursor-pointer"
                      style={{ color: "var(--spark-text)" }}
                    >
                      {v.storeLabel}
                    </button>
                    <span className="text-xs ml-2 tab-num" style={META}>
                      {v.visitDate} · {v.primaryProviderName ?? "Direct"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className="px-2.5 py-0.5 rounded-md font-semibold"
                      style={{ background: setMeta.bg, color: setMeta.fg }}
                    >
                      {setMeta.label}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-md font-semibold"
                      style={{ background: evMeta.bg, color: evMeta.fg }}
                    >
                      {evMeta.label}
                    </span>
                    <span className="tab-num font-bold text-sm">
                      {formatHonestMoney(v.totalCost, {
                        isConfirmedZero: v.totalCost === "0.00",
                        incomplete: v.isCostIncomplete,
                      })}
                    </span>
                  </div>
                </div>

                {v.costLines.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 text-xs">
                    {v.costLines.map((cl) => (
                      <div
                        key={cl.uuid}
                        className="px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                        style={{
                          ...BORDER,
                          background: "var(--spark-surface-2)",
                        }}
                      >
                        <div>
                          <div className="font-medium capitalize">
                            {cl.category.replace(/_/g, " ")}
                          </div>
                          <div className="text-[11px]" style={META}>
                            {cl.sourceType}
                            {cl.hasUnitemizedProof ? " · unitemized slip" : ""}
                          </div>
                        </div>
                        <span className="tab-num font-semibold">
                          {formatHonestMoney(cl.amount, {
                            isConfirmedZero: cl.isConfirmedZero,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] flex flex-wrap gap-4 pt-1 tab-num" style={META}>
                  <span>
                    Supported: <strong>${v.supportedCost}</strong>
                  </span>
                  <span>
                    Cost / sample:{" "}
                    <strong>
                      {v.costPerSample ? `$${v.costPerSample}` : "Withheld"}
                    </strong>
                  </span>
                  <span>
                    Cost / observed unit:{" "}
                    <strong>
                      {v.costPerObservedUnit
                        ? `$${v.costPerObservedUnit}`
                        : "Withheld"}
                    </strong>
                  </span>
                  {v.efficiencyWithheldReason && (
                    <span style={{ color: "var(--spark-warn-badge-ink)" }}>
                      {v.efficiencyWithheldReason}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export const DemoCostsPage: React.FC = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  const [groupBy, setGroupBy] = useState("store");
  const [range, setRange] = useState<PilotRangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [fetchKey, setFetchKey] = useState(0);

  const { periodStart, periodEnd } = useMemo(
    () => resolvePilotPeriod(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  return (
    <div className="space-y-5 max-w-7xl spark-scale">
      <div className="flex flex-wrap items-center gap-2">
        <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
        <SparkHubTabs tabs={BUDGET_PNL_SUBTABS} ariaLabel="Budget & P&L views" />
      </div>
      <Suspense fallback={<p className="text-sm" style={META}>Loading demo costs…</p>}>
        <DemoCostsBody
          key={tenantId ?? "none"}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
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
              ariaLabel="Demo cost date window"
            />
          }
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default DemoCostsPage;
