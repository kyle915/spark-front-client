import React, { Suspense, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  evidenceBadgeMeta,
  formatHonestMoney,
  settlementBadgeMeta,
  type CostEvidenceKind,
  type CostSettlementKind,
} from "./pilotHelpers";
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

const FEE_BASE_OPTIONS = [
  { key: "product", label: "Product purchases" },
  { key: "demo_fee", label: "Demo fee" },
  { key: "supplies", label: "Supplies" },
  { key: "travel_parking_tolls", label: "Travel / parking" },
] as const;

const DemoCostsBody: React.FC<{
  groupBy: string;
  setGroupBy: (g: string) => void;
  fetchKey: number;
  bump: () => void;
}> = ({ groupBy, setGroupBy, fetchKey, bump }) => {
  const data = useLazyLoadQuery<CostsQueryType>(
    PilotQueriesDemoCostsPageQuery,
    {
      groupBy,
      periodStart: null,
      periodEnd: null,
      providerUuid: null,
    },
    { fetchPolicy: "network-only", fetchKey },
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

  // Agreement form state
  const [agProviderUuid, setAgProviderUuid] = useState(
    ws.providers[0]?.uuid ?? "",
  );
  const [agName, setAgName] = useState("Standard Retail Rate Card");
  const [agDemoFee, setAgDemoFee] = useState("225.00");
  const [agAdminPct, setAgAdminPct] = useState("10.00");
  const [agBases, setAgBases] = useState<string[]>(["product"]);

  // Cost line form state
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
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Brand-Visible Economics · Never Exposes Worker Pay
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Actual Cost per Demo & Rollups
          </h1>
          <p className="text-xs mt-1" style={META}>
            Unknown rates stay explicitly marked Unknown (never $0.00). Efficiency metrics withhold until proof & rates are complete.
          </p>
        </div>
        <Link
          to="/finance-queue"
          className="px-4 py-2 rounded-xl text-xs font-bold"
          style={{
            background: "rgba(239,90,42,0.16)",
            color: "#ef5a2a",
            border: "1px solid rgba(239,90,42,0.4)",
          }}
        >
          Open Finance Exception Queue →
        </Link>
      </header>

      {banner && (
        <div
          className="p-3 rounded-xl text-xs"
          style={{
            background: "rgba(197,245,70,0.12)",
            color: "#c5f546",
            border: "1px solid rgba(197,245,70,0.3)",
          }}
        >
          {banner}
        </div>
      )}

      {/* Rollup Table */}
      <section className="spark-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-lg font-bold">Cost Rollups</h2>
          <div className="inline-flex rounded-full p-0.5" style={BORDER}>
            {(["store", "program", "provider", "month"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
                style={
                  groupBy === g
                    ? { background: "#c5f546", color: "#0A0B0D" }
                    : META
                }
              >
                By {g}
              </button>
            ))}
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
                  <th className="py-2 pr-3 capitalize">{groupBy}</th>
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
                    <td className="py-2.5 pr-3 font-semibold">{r.label}</td>
                    <td className="py-2.5 pr-3 mono">
                      {r.visitCount} ({r.completeVisitCount} ok /{" "}
                      {r.incompleteVisitCount} inc)
                    </td>
                    <td className="py-2.5 pr-3 mono font-semibold">
                      {r.totalCost != null
                        ? formatHonestMoney(r.totalCost, {
                            isConfirmedZero: true,
                          })
                        : `${formatHonestMoney(r.knownTotalCost, { isConfirmedZero: true })} + Unknown`}
                    </td>
                    <td className="py-2.5 pr-3 mono" style={{ color: "#c5f546" }}>
                      {formatHonestMoney(r.supportedCost, {
                        isConfirmedZero: true,
                      })}
                    </td>
                    <td className="py-2.5 pr-3 mono" style={META}>
                      ${r.invoicedCost} / ${r.paidCost}
                    </td>
                    <td className="py-2.5 pr-3 mono">
                      {r.costPerSample ? `$${r.costPerSample}` : "Withheld"}
                    </td>
                    <td className="py-2.5 text-right mono">
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
                className="px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
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
                className="px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
              />
              <label className="space-y-1">
                <span style={META}>Contracted Demo Fee ($)</span>
                <input
                  value={agDemoFee}
                  onChange={(e) => setAgDemoFee(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl mono bg-black/30"
                  style={BORDER}
                />
              </label>
              <label className="space-y-1">
                <span style={META}>Admin / Service Fee (%)</span>
                <input
                  value={agAdminPct}
                  onChange={(e) => setAgAdminPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl mono bg-black/30"
                  style={BORDER}
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
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
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
                className="col-span-2 px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
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
                className="px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
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
                className="px-3 py-2 rounded-xl mono bg-black/30"
                style={BORDER}
              />
              <select
                value={lineSettlement}
                onChange={(e) => setLineSettlement(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
              >
                <option value="estimated">Estimated</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
              </select>
              <input
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                placeholder="Invoice # or note"
                className="px-3 py-2 rounded-xl bg-black/30"
                style={BORDER}
              />
            </div>
            <button
              type="submit"
              disabled={savingLine}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
            >
              + Add Cost Line
            </button>
          </form>
        </div>
      )}

      {/* Per-Visit Breakdown */}
      <section className="spark-card p-5 space-y-4">
        <h2 className="display text-lg font-bold">
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
              <div key={v.uuid} className="p-4 rounded-2xl space-y-2" style={BORDER}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm">{v.storeLabel}</span>
                    <span className="text-xs ml-2 mono" style={META}>
                      {v.visitDate} · {v.primaryProviderName ?? "Direct"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className="px-2.5 py-0.5 rounded-full font-semibold"
                      style={{ background: setMeta.bg, color: setMeta.fg }}
                    >
                      {setMeta.label}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full font-semibold"
                      style={{ background: evMeta.bg, color: evMeta.fg }}
                    >
                      {evMeta.label}
                    </span>
                    <span className="mono font-bold text-sm">
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
                        className="px-3 py-2 rounded-xl bg-black/25 flex items-center justify-between gap-2"
                        style={BORDER}
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
                        <span className="mono font-semibold">
                          {formatHonestMoney(cl.amount, {
                            isConfirmedZero: cl.isConfirmedZero,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] flex flex-wrap gap-4 pt-1" style={META}>
                  <span>
                    Supported: <strong className="mono">${v.supportedCost}</strong>
                  </span>
                  <span>
                    Cost / sample:{" "}
                    <strong className="mono">
                      {v.costPerSample ? `$${v.costPerSample}` : "Withheld"}
                    </strong>
                  </span>
                  <span>
                    Cost / observed unit:{" "}
                    <strong className="mono">
                      {v.costPerObservedUnit
                        ? `$${v.costPerObservedUnit}`
                        : "Withheld"}
                    </strong>
                  </span>
                  {v.efficiencyWithheldReason && (
                    <span style={{ color: "#fde047" }}>
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
  const [groupBy, setGroupBy] = useState("store");
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="p-4 lg:p-8">
      <Suspense fallback={<p className="text-sm mono">Loading demo costs…</p>}>
        <DemoCostsBody
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default DemoCostsPage;
