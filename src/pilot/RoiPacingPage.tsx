import React, { Suspense, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RoiPacingPageQuery } from "@/api/queries/RoiPacingQueries";
import { UpsertDemoBudgetTargetMutation } from "@/api/mutations/RoiPacingMutations";
import type { RoiPacingQueriesPageQuery as PacingQueryType } from "@/api/queries/__generated__/RoiPacingQueriesPageQuery.graphql";
import type { RoiPacingMutationsUpsertDemoBudgetTargetMutation as UpsertMutationType } from "@/api/mutations/__generated__/RoiPacingMutationsUpsertDemoBudgetTargetMutation.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-accent-strong, #1a5c3a)",
  color: "#fff",
  border: "1px solid var(--spark-accent-strong, #1a5c3a)",
} as const;

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
    { fetchPolicy: "network-only", fetchKey },
  );
  const pacing = data.demoBudgetPacingAndLeaderboard;
  const [commitUpsert, saving] = useMutation<UpsertMutationType>(
    UpsertDemoBudgetTargetMutation,
  );
  const [amount, setAmount] = useState(pacing?.targetAmount ?? "");
  const [banner, setBanner] = useState<string | null>(null);

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
        scopeKey: "",
        scopeLabel: "Workspace",
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
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Demo budget · Honest spend vs pace
          </p>
          <h1
            className="text-2xl font-semibold mt-1"
            style={{ color: "var(--spark-text)" }}
          >
            Budget pacing & ROI leaderboard
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={META}>
            Spent and committed demo dollars against your monthly target, plus
            retailers, markets, or SKUs ranked by units or register sales per
            demo dollar. Lift is never invented when POS coverage is missing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/demo-costs" className="underline" style={{ color: "var(--spark-link, var(--spark-text))" }}>
            Demo costs
          </Link>
          <Link to="/retailer-pos" className="underline" style={{ color: "var(--spark-link, var(--spark-text))" }}>
            Retailer POS
          </Link>
          <Link to="/buyer-report" className="underline" style={{ color: "var(--spark-link, var(--spark-text))" }}>
            Buyer report
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span style={META}>Month</span>
          <input
            type="month"
            className="block mt-1 rounded px-3 py-2"
            style={FIELD_STYLE}
            value={monthInputValue(month)}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span style={META}>Group by</span>
          <select
            className="block mt-1 rounded px-3 py-2"
            style={FIELD_STYLE}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="retailer">Retailer</option>
            <option value="market">Market</option>
            <option value="sku">SKU</option>
          </select>
        </label>
        <label className="text-sm">
          <span style={META}>Sort</span>
          <select
            className="block mt-1 rounded px-3 py-2"
            style={FIELD_STYLE}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="units_per_dollar">Units / $</option>
            <option value="revenue_per_dollar">Revenue / $</option>
          </select>
        </label>
      </div>

      {banner ? (
        <p
          className="text-sm rounded px-3 py-2"
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
            className="text-xs px-2 py-1 rounded"
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
              <p className="text-xs uppercase tracking-wider" style={META}>
                {label}
              </p>
              <p
                className="text-xl font-semibold mono mt-1"
                style={{ color: "var(--spark-text)" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="relative h-3 rounded overflow-hidden" style={{ background: "var(--spark-surface-2, #e8e8e8)" }}>
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${Math.min(spendPct * 100, 100)}%`,
              background: "var(--spark-accent-strong, #1a5c3a)",
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
        <p className="text-xs" style={META}>
          Bar = spent + committed vs target. Tick = elapsed month (
          {pacing.elapsedDays}/{pacing.daysInMonth} days). Visits counted:{" "}
          {pacing.visitCount}.
        </p>

        {pacing.canEditBudget ? (
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <label className="text-sm">
              <span style={META}>Workspace monthly target</span>
              <input
                className="block mt-1 rounded px-3 py-2 w-40 mono"
                style={FIELD_STYLE}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000.00"
              />
            </label>
            <button
              type="button"
              className="rounded px-4 py-2 text-sm font-medium"
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
                {pacing.leaderboard.map((row) => (
                  <tr
                    key={row.groupKey}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2">
                      <div style={{ color: "var(--spark-text)" }}>
                        {row.groupLabel}
                      </div>
                      {row.note ? (
                        <div className="text-xs mt-0.5" style={META}>
                          {row.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right mono py-2">{row.visitCount}</td>
                    <td className="text-right mono py-2">
                      {money(row.demoDollars)}
                    </td>
                    <td className="text-right mono py-2">
                      {row.units ?? "—"}
                    </td>
                    <td className="text-right mono py-2">
                      {money(row.salesDollars)}
                    </td>
                    <td className="text-right mono py-2">
                      {rate(row.unitsPerDollar)}
                    </td>
                    <td className="text-right mono py-2">
                      {rate(row.revenuePerDollar)}
                    </td>
                  </tr>
                ))}
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
    <ErrorBoundary>
      <Suspense fallback={<p style={META}>Loading pacing…</p>}>
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
  );
};

export default RoiPacingPage;
