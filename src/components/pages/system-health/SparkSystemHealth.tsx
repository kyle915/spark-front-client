import { useCallback, useEffect, useState } from "react";
import Layout from "@/layout/Layout";

/**
 * System Health — Ignite-admin observability. Surfaces the backend error
 * monitor (digest.BackendErrorEvent, which also captures silent email/push
 * delivery failures) + the running revision, so problems are visible in the
 * app instead of only in the throttled alert email.
 *
 * Backed by the Spark schema `systemHealth` query (admin-gated server-side;
 * non-admins get null). Raw postGql — same pattern as NotificationBell /
 * BaActivationPanel, no Relay codegen.
 */

async function postGql<T>(query: string): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  return json.data as T;
}

type ErrorRow = {
  signature: string;
  message: string;
  location: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};
type CronRow = {
  name: string;
  lastRunAt: string | null;
  lastOk: boolean;
  lastStatus: number;
  runCount: number;
  hoursSince: number | null;
};
type Health = {
  serverTime: string;
  gitSha: string;
  revision: string;
  databaseOk: boolean;
  errors24h: number;
  errors7d: number;
  distinctSignatures: number;
  recentErrors: ErrorRow[];
  cronRuns: CronRow[];
};

const QUERY = `query SystemHealth {
  systemHealth {
    serverTime gitSha revision databaseOk
    errors24h errors7d distinctSignatures
    recentErrors { signature message location count firstSeen lastSeen }
    cronRuns { name lastRunAt lastOk lastStatus runCount hoursSince }
  }
}`;

const fmt = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
};

const fmtAgo = (hours: number | null): string => {
  if (hours == null) return "never run";
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({
  label, value, tone,
}) => (
  <div className="spark-card p-4">
    <p
      className="mono text-[10px]"
      style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
    >
      {label}
    </p>
    <p
      className="display text-3xl font-bold mt-1"
      style={{ color: tone ?? "var(--spark-text)", letterSpacing: "-0.03em" }}
    >
      {value}
    </p>
  </div>
);

const Inner: React.FC = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postGql<{ systemHealth: Health | null }>(QUERY);
      setHealth(data.systemHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errTone = (n: number) =>
    n > 0 ? "var(--spark-orange)" : "var(--spark-lime)";

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            SYSTEM
          </p>
          <h1 className="display text-4xl font-bold mt-2" style={{ letterSpacing: "-0.04em" }}>
            System health.
          </h1>
          <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
            Backend errors, delivery failures, and the running build. Problems
            show here the moment they happen — no waiting on an alert email.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="spark-card p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Loading system health…
        </div>
      ) : error ? (
        <div className="spark-card p-6 text-sm" style={{ color: "var(--spark-gold)" }}>
          Couldn't load system health: {error}
        </div>
      ) : !health ? (
        <div className="spark-card p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Not available for this account.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="ERRORS · 24H" value={String(health.errors24h)} tone={errTone(health.errors24h)} />
            <Stat label="ERRORS · 7D" value={String(health.errors7d)} tone={errTone(health.errors7d)} />
            <Stat label="DISTINCT SIGNATURES" value={String(health.distinctSignatures)} />
            <Stat
              label="DATABASE"
              value={health.databaseOk ? "OK" : "DOWN"}
              tone={health.databaseOk ? "var(--spark-lime)" : "var(--spark-orange)"}
            />
          </div>

          <div className="spark-card p-4">
            <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}>
              RUNNING BUILD
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--spark-text-secondary)" }}>
              <span className="mono">{health.gitSha}</span> · {health.revision} · as of {fmt(health.serverTime)}
            </p>
          </div>

          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="display text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
                Automations
              </h2>
              <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                Every internal cron stamps a heartbeat when it fires — this is
                the thing that was invisible when the scheduler silently died.
              </span>
            </div>
            <div className="spark-card overflow-hidden" style={{ borderRadius: 20 }}>
              {health.cronRuns.length === 0 ? (
                <div className="p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
                  No cron has fired yet. Heartbeats appear here the first time
                  each scheduled job runs.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 640 }}>
                    <thead style={{ background: "var(--spark-surface-2)", borderBottom: "1px solid var(--spark-border)" }}>
                      <tr className="text-left mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}>
                        <th className="px-4 py-3">AUTOMATION</th>
                        <th className="px-4 py-3">STATUS</th>
                        <th className="px-4 py-3">LAST RUN</th>
                        <th className="px-4 py-3">RUNS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...health.cronRuns]
                        .sort((a, b) => (b.hoursSince ?? 1e9) - (a.hoursSince ?? 1e9))
                        .map((c) => (
                          <tr key={c.name} style={{ borderBottom: "1px solid var(--spark-border)" }}>
                            <td className="px-4 py-3 mono text-xs">{c.name}</td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                                style={{ color: c.lastOk ? "var(--spark-lime)" : "var(--spark-orange)" }}
                              >
                                <span
                                  style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: c.lastOk ? "var(--spark-lime)" : "var(--spark-orange)",
                                    display: "inline-block",
                                  }}
                                />
                                {c.lastOk ? "OK" : `HTTP ${c.lastStatus}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {fmtAgo(c.hoursSince)}
                              <span className="text-[10px] ml-2" style={{ color: "var(--spark-text-meta)" }}>
                                {c.lastRunAt ? fmt(c.lastRunAt) : ""}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="chip">{c.runCount}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="display text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
                Recent errors
              </h2>
              <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                Most recent 25 signatures · throttled to one alert email per signature per hour.
              </span>
            </div>
            <div className="spark-card overflow-hidden" style={{ borderRadius: 20 }}>
              {health.recentErrors.length === 0 ? (
                <div className="p-6 text-sm" style={{ color: "var(--spark-lime)" }}>
                  No backend errors recorded. All clear.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 800 }}>
                    <thead style={{ background: "var(--spark-surface-2)", borderBottom: "1px solid var(--spark-border)" }}>
                      <tr className="text-left mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}>
                        <th className="px-4 py-3">SIGNATURE</th>
                        <th className="px-4 py-3">COUNT</th>
                        <th className="px-4 py-3">LAST SEEN</th>
                        <th className="px-4 py-3">MESSAGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.recentErrors.map((r) => (
                        <tr key={r.signature} style={{ borderBottom: "1px solid var(--spark-border)" }}>
                          <td className="px-4 py-3">
                            <div className="mono text-xs">{r.signature}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                              {r.location}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="chip chip-gold">×{r.count}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{fmt(r.lastSeen)}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs" style={{ color: "var(--spark-text-secondary)", maxWidth: 420 }}>
                              {r.message}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SparkSystemHealth: React.FC = () => (
  <Layout>
    <Inner />
  </Layout>
);

export default SparkSystemHealth;
