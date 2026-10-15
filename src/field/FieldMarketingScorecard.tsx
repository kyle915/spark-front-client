import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuthStore } from "@/store/authStore";
import FieldMarketingEventRecaps from "./FieldMarketingEventRecaps";
import ScorecardKpiCard, { type ScorecardKpi } from "./ScorecardKpiCard";

/**
 * Monthly Field Marketing scorecard for the dashboard.
 * Each card leads with the actual result for the month (a plan's manual log,
 * else approved recaps attached to it) against the monthly target; the plan
 * forecast is secondary. Not retail recaps. Pours are not added into full cans.
 * Targets: full cans 1,152; pours 3,456; 8 sponsorship days; 4 retail supports; 500 emails.
 */

type Manager = {
  market: string;
  marketLabel: string;
  name: string;
  email: string;
  phone: string;
};

type Kpi = ScorecardKpi;

type Board = {
  available: boolean;
  month: string;
  monthLabel: string;
  managers: Manager[];
  kpis: Kpi[];
};

/** Stable empty skeleton so the five buckets never disappear while loading. */
const EMPTY_KPIS: Kpi[] = [
  {
    key: "full_cans",
    label: "Full can samples",
    detail: "Product drops, donations, guerilla events. Drives trial and awareness.",
    target: 1152,
    planned: null,
    logged: null,
    unit: "cans",
  },
  {
    key: "pour_samples",
    label: "4oz pour samples",
    detail: "Local sponsorships, events, festivals. 3,456 pours is 1,152 full cans.",
    target: 3456,
    planned: null,
    logged: null,
    unit: "pours",
  },
  {
    key: "sponsorship_days",
    label: "Local event sponsorships",
    detail: "Minimum days. Builds meaningful local presence.",
    target: 8,
    planned: null,
    logged: null,
    unit: "days",
  },
  {
    key: "retail_support",
    label: "Retail activations / support",
    detail: "On-premise support, retail check-in, sales and DP meetings.",
    target: 4,
    planned: null,
    logged: null,
    unit: "activations",
  },
  {
    key: "emails",
    label: "Consumer data captured",
    detail: "Email addresses. Builds an addressable audience.",
    target: 500,
    planned: null,
    logged: null,
    unit: "emails",
  },
];

const FALLBACK_MANAGERS: Manager[] = [
  {
    market: "miami",
    marketLabel: "Miami",
    name: "Alec Aparicio",
    email: "alec@torchdrinks.com",
    phone: "786-348-9538",
  },
  {
    market: "orlando",
    marketLabel: "Orlando",
    name: "Octavius Jefferson",
    email: "octavius@torchdrinks.com",
    phone: "772-646-2137",
  },
  {
    market: "houston",
    marketLabel: "Houston",
    name: "Victoria Quintana",
    email: "victoria@torchdrinks.com",
    phone: "979-575-1622",
  },
  {
    market: "austin-dallas",
    marketLabel: "Austin / Dallas",
    name: "Brittany Senglin",
    email: "brittany@torchdrinks.com",
    phone: "972-978-7253",
  },
];

const BOARD = `
  query FieldMarketingBoard($month: String, $tenantId: ID, $market: String) {
    fieldMarketing(month: $month, tenantId: $tenantId, market: $market) {
      available
      month
      monthLabel
      managers { market marketLabel name email phone }
      kpis { key label detail target planned logged unit note }
    }
  }
`;

async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}

function shiftMonth(month: string, delta: number): string {
  const [yearS, monS] = month.split("-");
  const cursor = new Date(Number(yearS), Number(monS) - 1 + delta, 1);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FieldMarketingScorecard() {
  const { tenantId } = useAuthStore();
  const [month, setMonth] = useState(currentMonth);
  const [marketFilter, setMarketFilter] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextMonth: string, nextMarket: string) => {
      setLoading(true);
      setError("");
      try {
        const data = await postGql<{ fieldMarketing: Board }>(BOARD, {
          month: nextMonth,
          tenantId: tenantId || null,
          market: nextMarket || null,
        });
        setBoard(data.fieldMarketing);
        setMonth(data.fieldMarketing.month || nextMonth);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load the scorecard.",
        );
      } finally {
        setLoading(false);
      }
    },
    [tenantId],
  );

  useEffect(() => {
    void load(month, marketFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, marketFilter]);

  const kpis = useMemo(() => {
    const rows = board?.kpis?.length ? board.kpis : EMPTY_KPIS;
    return rows;
  }, [board]);

  const managers = board?.managers?.length ? board.managers : FALLBACK_MANAGERS;
  const activeManager = marketFilter
    ? managers.find((m) => m.market === marketFilter)
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="spark-btn-ghost"
            onClick={() => {
              const next = shiftMonth(month, -1);
              setMonth(next);
              void load(next, marketFilter);
            }}
          >
            Prev
          </button>
          <p className="spark-title text-lg">{board?.monthLabel || month}</p>
          <button
            type="button"
            className="spark-btn-ghost"
            onClick={() => {
              const next = shiftMonth(month, 1);
              setMonth(next);
              void load(next, marketFilter);
            }}
          >
            Next
          </button>
        </div>
        <Link to="/field-marketing" className="spark-btn-ghost">
          Open Plans
        </Link>
      </div>

      <div
        className="flex flex-wrap gap-2 items-center"
        role="tablist"
        aria-label="RMM market"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!marketFilter}
          className={`pill-btn ${!marketFilter ? "on" : ""}`}
          onClick={() => setMarketFilter("")}
        >
          All markets
        </button>
        {managers.map((manager) => (
          <button
            key={manager.market}
            type="button"
            role="tab"
            aria-selected={marketFilter === manager.market}
            className={`pill-btn ${marketFilter === manager.market ? "on" : ""}`}
            onClick={() => setMarketFilter(manager.market)}
            title={`${manager.name} · ${manager.email}`}
          >
            {manager.marketLabel} · {manager.name.split(" ")[0]}
          </button>
        ))}
      </div>
      {activeManager ? (
        <p className="text-sm opacity-70">
          RMM · {activeManager.name} · {activeManager.phone} ·{" "}
          <a href={`mailto:${activeManager.email}`}>{activeManager.email}</a>
        </p>
      ) : (
        <p className="text-xs opacity-55">
          Filter by market / RMM to scope projected and logged totals.
        </p>
      )}

      {error ? (
        <p className="text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <ScorecardKpiCard key={kpi.key} kpi={kpi} loading={loading && !board} />
        ))}
      </div>
      <p className="text-xs opacity-60">
        Big number is the actual for {board?.monthLabel || "this month"}: a
        plan's logged result, else the approved recaps attached to it (Event,
        Guerilla, Seeding — not retail sampling). Event days count days with an
        approved recap. Full cans come from recaps that served full cans; cans
        opened only for 4oz pours aren't converted into pours, so log pours on
        the plan. Planned is the plan forecast, and Event / Guerilla plans
        don't forecast cans or pours. A dash means nothing reported yet.
      </p>

      <FieldMarketingEventRecaps
        month={board?.month && board.month !== "all" ? board.month : month}
        market={marketFilter}
        managers={managers}
        onAttached={() => void load(month, marketFilter)}
      />
    </section>
  );
}
