import React, { Suspense, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RoiPacingPageQuery } from "@/api/queries/RoiPacingQueries";
import { UpsertDemoBudgetTargetMutation } from "@/api/mutations/RoiPacingMutations";
import type { RoiPacingQueriesPageQuery as PacingQueryType } from "@/api/queries/__generated__/RoiPacingQueriesPageQuery.graphql";
import type { RoiPacingMutationsUpsertDemoBudgetTargetMutation as UpsertMutationType } from "@/api/mutations/__generated__/RoiPacingMutationsUpsertDemoBudgetTargetMutation.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { BUDGET_PNL_SUBTABS, REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import { syncedTargetEditorAmount } from "./roiPacingHelpers";

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

const GROUP_OPTIONS = [
  { key: "retailer", label: "Retailer" },
  { key: "market", label: "Market" },
  { key: "sku", label: "SKU" },
] as const;

const SORT_OPTIONS = [
  { key: "units_per_dollar", label: "Units / $" },
  { key: "revenue_per_dollar", label: "Revenue / $" },
] as const;

const money = (raw: string | null | undefined): string => {
  if (raw == null || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const rate = (raw: string | null | undefined): string => {
  if (raw == null || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "under_booked":
      return "Under-booked";
    case "over_booked":
      return "Over-booked";
    case "on_track":
      return "On track";
    case "no_target":
      return "No target set";
    default:
      return status;
  }
};

const statusStyle = (status: string): React.CSSProperties => {
  if (status === "under_booked") {
    return {
      background: "var(--spark-warn-bg, #fff4e0)",
      color: "var(--spark-warn-ink, #6b3b00)",
      border: "1px solid var(--spark-warn-border, #e8c98a)",
    };
  }
  if (status === "over_booked") {
    return {
      background: "var(--spark-danger-bg, #fde8e8)",
      color: "var(--spark-danger-ink, #7a1f1f)",
      border: "1px solid var(--spark-danger-border, #e8b4b4)",
    };
  }
  if (status === "on_track") {
    return {
      background: "var(--spark-ok-bg, #e6f4ea)",
      color: "var(--spark-ok-ink, #14532d)",
      border: "1px solid var(--spark-ok-border, #86efac)",
    };
  }
  return {
    background: "var(--spark-surface-2, var(--spark-surface))",
    color: "var(--spark-text)",
    ...BORDER,
  };
};

const monthInputValue = (iso: string | null | undefined): string => {
  if (!iso) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return iso.slice(0, 7);
};

const PacingBody: React.FC<{
  month: string;
  groupBy: string;
  sortBy: string;
  setMonth: (m: string) => void;
  setGroupBy: (g: string) => void;
  setSortBy: (s: string) => void;
  fetchKey: number;
  bump: () => void;
}> = ({
  month,
  groupBy,
  sortBy,
  setMonth,
  setGroupBy,
  setSortBy,
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<PacingQueryType>(
    RoiPacingPageQuery,
    { month, groupBy, sortBy },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const pacing = data?.demoBudgetPacingAndLeaderboard ?? null;
  const [commitUpsert, saving] = useMutation<UpsertMutationType>(
    UpsertDemoBudgetTargetMutation,
  );
  const [amount, setAmount] = useState(pacing?.targetAmount ?? "");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setAmount(
      syncedTargetEditorAmount({
        selectedMonth: month,
        serverMonth: pacing?.month ?? null,
        serverTarget: pacing?.targetAmount ?? null,
      }),
    );
  }, [month, pacing?.month, pacing?.targetAmount]);

  if (!pacing) {
    return (
      <p style={META}>
        Budget pacing is available once you open a brand workspace.
      </p>
    );
  }

  const target = Number(pacing.targetAmount || 0);
  const projected = Number(pacing.projectedAmount || 0);
  const elapsedPct = Number(pacing.elapsedPct || 0);
  const spendPct = target > 0 ? Math.min(projected / target, 1.25) : 0;

  const saveTarget = () => {
    setBanner(null);
    commitUpsert({
      variables: {
        targetAmount: amount || "0",
        month,
        scopeType: "workspace",
        scopeLabel: "Workspace",
        scopeKey: "",
        notes: "",
      },
      onCompleted: (res) => {
        if (res.upsertDemoBudgetTarget?.ok) {
          setBanner("Monthly target saved.");
          bump();
        } else {
          setBanner(res.upsertDemoBudgetTarget?.reason || "Could not save.");
        }
      },
      onError: () => setBanner("Could not save budget target."),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <SparkPageHeader
        eyebrow="Demo budget · Spend vs pace"
        title="Budget pacing & ROI leaderboard"
        support="Spent and committed demo dollars against your monthly target, plus retailers, markets, or SKUs ranked by units or register sales per demo dollar."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium">
          <span style={META}>Month</span>
          <input
            type="month"
            className="rounded-lg px-3 py-1.5 text-xs tab-num"
            style={FIELD_STYLE}
            value={monthInputValue(month)}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div className="pill-group" role="group" aria-label="Group leaderboard by">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setGroupBy(opt.key)}
                className={`pill-btn ${groupBy === opt.key ? "on" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="pill-group" role="group" aria-label="Sort leaderboard by">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortBy(opt.key)}
                className={`pill-btn ${sortBy === opt.key ? "on" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {banner ? (
        <p
          className="text-xs font-medium rounded-lg px-3 py-2"
          style={{
            background: "var(--spark-ok-bg, #e6f4ea)",
            color: "var(--spark-ok-ink, #14532d)",
            border: "1px solid var(--spark-ok-border, #86efac)",
          }}
        >
          {banner}
        </p>
      ) : null}

      <section className="spark-card spark-panel space-y-4" style={BORDER}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="spark-panel-title">Monthly pacing</h2>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-md"
            style={statusStyle(pacing.paceStatus)}
          >
            {statusLabel(pacing.paceStatus)}
          </span>
        </div>
        <p className="text-sm" style={META}>
          {pacing.paceNote}
          {pacing.incompleteCostVisits > 0
            ? ` · ${pacing.incompleteCostVisits} visit(s) still missing complete costs.`
            : ""}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Target", money(pacing.targetAmount)],
            ["Spent", money(pacing.spentAmount)],
            ["Committed", money(pacing.committedAmount)],
            ["Projected", money(pacing.projectedAmount)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-medium" style={META}>
                {label}
              </p>
              <p
                className="display text-2xl font-bold tab-num mt-1"
                style={{ color: "var(--spark-text)", letterSpacing: "-0.025em" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div
          className="relative h-2.5 rounded-md overflow-hidden"
          style={{ background: "var(--spark-surface-2, #e8e8e8)" }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${Math.min(spendPct * 100, 100)}%`,
              background: "var(--spark-lime)",
            }}
            title={`Projected ${money(String(projected))}`}
          />
          <div
            className="absolute inset-y-0 w-0.5"
            style={{
              left: `${Math.min(elapsedPct * 100, 100)}%`,
              background: "var(--spark-text)",
            }}
            title={`Elapsed ${Math.round(elapsedPct * 100)}% of month`}
          />
        </div>
        <p className="text-xs tab-num" style={META}>
          Bar = spent + committed vs target. Tick = elapsed month (
          {pacing.elapsedDays}/{pacing.daysInMonth} days). Visits counted:{" "}
          {pacing.visitCount}.
        </p>

        {pacing.canEditBudget ? (
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <label className="text-xs font-medium">
              <span style={META}>Workspace monthly target</span>
              <input
                className="block mt-1 rounded-lg px-3 py-2 w-40 tab-num text-sm"
                style={FIELD_STYLE}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000.00"
              />
            </label>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={PRIMARY_BTN_STYLE}
              disabled={saving}
              onClick={saveTarget}
            >
              {saving ? "Saving…" : "Save target"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="spark-card spark-panel" style={BORDER}>
        <div className="spark-panel-head">
          <h2 className="spark-panel-title">ROI leaderboard</h2>
        </div>
        {pacing.leaderboard.length === 0 ? (
          <p className="text-sm py-4" style={META}>
            No visits in this month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={META}>
                  <th className="text-left font-medium py-2">Group</th>
                  <th className="text-right font-medium py-2">Visits</th>
                  <th className="text-right font-medium py-2">Demo $</th>
                  <th className="text-right font-medium py-2">Units</th>
                  <th className="text-right font-medium py-2">Sales $</th>
                  <th className="text-right font-medium py-2">Units/$</th>
                  <th className="text-right font-medium py-2">Rev/$</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxVisits = Math.max(
                    1,
                    ...pacing.leaderboard.map((r) => r.visitCount || 0),
                  );
                  return pacing.leaderboard.map((row) => {
                    const displayGroup =
                      row.groupLabel.trim().toLowerCase() === "unknown"
                        ? "Unassigned / Direct"
                        : row.groupLabel;
                    const visitSharePct = Math.min(
                      100,
                      Math.round(((row.visitCount || 0) / maxVisits) * 100),
                    );
                    return (
                      <tr
                        key={row.groupKey}
                        style={{ borderTop: "1px solid var(--spark-border)" }}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="font-medium" style={{ color: "var(--spark-text)" }}>
                            {displayGroup}
                          </div>
                          <div
                            className="mt-1 h-1.5 rounded-sm overflow-hidden max-w-[160px]"
                            style={{ background: "rgba(var(--spark-ink-rgb),0.07)" }}
                          >
                            <div
                              className="h-full rounded-sm"
                              style={{
                                width: `${visitSharePct}%`,
                                background: "var(--spark-lime)",
                              }}
                            />
                          </div>
                          {row.note ? (
                            <div className="text-xs mt-1" style={META}>
                              {row.note}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right tab-num py-2">{row.visitCount}</td>
                        <td className="text-right tab-num py-2">
                          {money(row.demoDollars)}
                        </td>
                        <td className="text-right tab-num py-2">
                          {row.units ?? "—"}
                        </td>
                        <td className="text-right tab-num py-2">
                          {money(row.salesDollars)}
                        </td>
                        <td className="text-right tab-num py-2">
                          {rate(row.unitsPerDollar)}
                        </td>
                        <td className="text-right tab-num py-2">
                          {rate(row.revenuePerDollar)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export const RoiPacingPage: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [groupBy, setGroupBy] = useState("retailer");
  const [sortBy, setSortBy] = useState("units_per_dollar");
  const [fetchKey, setFetchKey] = useState(0);

  return (
    <div className="space-y-5 max-w-7xl spark-scale">
      <div className="flex flex-wrap items-center gap-2">
        <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
        <SparkHubTabs tabs={BUDGET_PNL_SUBTABS} ariaLabel="Budget & P&L views" />
      </div>
      <ErrorBoundary>
        <Suspense fallback={<p className="text-sm" style={META}>Loading pacing…</p>}>
          <PacingBody
            month={month}
            groupBy={groupBy}
            sortBy={sortBy}
            setMonth={setMonth}
            setGroupBy={setGroupBy}
            setSortBy={setSortBy}
            fetchKey={fetchKey}
            bump={() => setFetchKey((k) => k + 1)}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default RoiPacingPage;
