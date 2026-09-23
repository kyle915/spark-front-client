import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

/**
 * Monthly Field Marketing scorecard for the dashboard.
 * Numbers come from fieldMarketing — the same targets as the planner
 * (full cans 1,152, pours 3,456, 8 sponsorship days, 4 retail supports, 500 emails).
 * Logged stays blank until someone reports a result. Pours are not added into full cans.
 */

type Kpi = {
  key: string;
  label: string;
  detail: string;
  target: number;
  planned: number;
  logged: number | null;
  unit: string;
};

type Board = {
  available: boolean;
  month: string;
  monthLabel: string;
  kpis: Kpi[];
};

const BOARD = `
  query FieldMarketingBoard($month: String) {
    fieldMarketing(month: $month) {
      available
      month
      monthLabel
      kpis { key label detail target planned logged unit }
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

function fmtNum(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

export default function FieldMarketingScorecard() {
  const [month, setMonth] = useState(currentMonth);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextMonth: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await postGql<{ fieldMarketing: Board }>(BOARD, {
        month: nextMonth,
      });
      setBoard(data.fieldMarketing);
      setMonth(data.fieldMarketing.month || nextMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the scorecard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(currentMonth());
  }, [load]);

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
              void load(next);
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
              void load(next);
            }}
          >
            Next
          </button>
        </div>
        <Link to="/field-marketing" className="spark-btn-ghost">
          Open the plan
        </Link>
      </div>

      {error ? (
        <p className="text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(board?.kpis ?? []).map((kpi) => (
          <article key={kpi.key} className="spark-card p-4">
            <p className="label-mini mb-2">{kpi.label}</p>
            <p className="tab-num text-2xl lg:text-3xl font-bold leading-none">
              {loading ? "…" : fmtNum(kpi.logged)}
              <span className="text-sm font-normal opacity-60">
                {" "}
                / {kpi.target.toLocaleString()}
              </span>
            </p>
            <p className="mt-3 text-xs opacity-70">
              Planned {kpi.planned.toLocaleString()} {kpi.unit}
            </p>
            <p className="mt-2 text-xs leading-snug opacity-60">{kpi.detail}</p>
          </article>
        ))}
      </div>
      <p className="text-xs opacity-60">
        The big number is logged against the monthly target. A dash means nobody
        has reported that result yet. Planned is what is on the calendar. 4oz
        pours stay on their own score and are not added into full can samples.
      </p>
    </section>
  );
}
