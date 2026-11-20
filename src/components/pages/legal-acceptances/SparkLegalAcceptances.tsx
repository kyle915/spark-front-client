import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchQuery, graphql } from "react-relay";
import Layout from "@/layout/Layout";
import environment from "@/api/relay/environment";
import type { SparkLegalAcceptancesQuery } from "./__generated__/SparkLegalAcceptancesQuery.graphql";
import {
  ROLE_LABEL,
  STATUS_LABEL,
  acceptanceRowsToCsv,
  sortAcceptanceRows,
  type AcceptanceRow,
} from "./legalAcceptanceRows";

/**
 * Staff only: who has accepted the Terms of Service (and AUP / Privacy
 * Policy), which version, when and from where. Backed by
 * `legalAcceptanceReport` (spark-api legal/schema.py), which is staff-gated
 * server-side.
 */

const query = graphql`
  query SparkLegalAcceptancesQuery($pendingOnly: Boolean!) {
    legalAcceptanceReport(pendingOnly: $pendingOnly) {
      currentVersion
      totalUsers
      acceptedCount
      pendingCount
      rows {
        userUuid
        email
        name
        role
        status
        acceptedVersion
        acceptedAt
        ipAddress
        userAgent
      }
    }
  }
`;

type Report = NonNullable<SparkLegalAcceptancesQuery["response"]["legalAcceptanceReport"]>;

const fmt = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="spark-card p-4">
    <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>{label}</p>
    <p className="display text-3xl font-bold mt-1" style={{ letterSpacing: "-0.03em" }}>{value}</p>
  </div>
);

const Inner = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuery<SparkLegalAcceptancesQuery>(
        environment, query, { pendingOnly }, { fetchPolicy: "network-only" }
      ).toPromise();
      setReport(data?.legalAcceptanceReport ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const all = sortAcceptanceRows((report?.rows ?? []) as AcceptanceRow[]);
    const q = search.trim().toLowerCase();
    return q
      ? all.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      : all;
  }, [report, search]);

  const download = () => {
    const blob = new Blob([acceptanceRowsToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legal-acceptances-${report?.currentVersion ?? "current"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="display text-4xl font-bold" style={{ letterSpacing: "-0.04em" }}>
          Legal acceptances
        </h1>
        <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
          Admin and brand users must accept the Terms of Service and Acceptable Use
          Policy, and acknowledge the Privacy Policy, before using Spark. Brand
          ambassadors are not included.
        </p>
      </div>

      {loading ? (
        <div className="spark-card p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Loading…
        </div>
      ) : error ? (
        <div className="spark-card p-6 text-sm" style={{ color: "var(--spark-flag-ink)" }}>
          Couldn't load acceptances: {error}
        </div>
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Current version" value={report.currentVersion} />
            <Stat label="Admin and brand users" value={String(report.totalUsers)} />
            <Stat label="Accepted" value={String(report.acceptedCount)} />
            <Stat label="Not accepted yet" value={String(report.pendingCount)} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
              />
              Only people who haven't accepted
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search name or email"
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--spark-surface)", border: "1px solid var(--spark-border)", minWidth: 240 }}
            />
            <button
              type="button"
              onClick={download}
              disabled={rows.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}
            >
              Download CSV
            </button>
          </div>

          <div className="spark-card overflow-hidden">
            {rows.length === 0 ? (
              <div className="p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
                No one to show.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 820 }}>
                  <thead style={{ background: "var(--spark-surface-2)", borderBottom: "1px solid var(--spark-border)" }}>
                    <tr className="text-left text-xs" style={{ color: "var(--spark-text-meta)" }}>
                      <th className="px-4 py-3 font-semibold">Person</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Version</th>
                      <th className="px-4 py-3 font-semibold">Accepted</th>
                      <th className="px-4 py-3 font-semibold">IP address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.userUuid} style={{ borderBottom: "1px solid var(--spark-border)" }}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{r.name || r.email}</div>
                          {r.name ? (
                            <div className="text-xs" style={{ color: "var(--spark-text-meta)" }}>{r.email}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{ROLE_LABEL[r.role] ?? r.role}</td>
                        <td
                          className="px-4 py-3 font-semibold"
                          style={{ color: r.status === "accepted" ? "var(--spark-text)" : "var(--spark-flag-ink)" }}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </td>
                        <td className="px-4 py-3">{r.acceptedVersion ?? "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmt(r.acceptedAt)}</td>
                        <td className="px-4 py-3" title={r.userAgent || undefined}>{r.ipAddress || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const SparkLegalAcceptances = () => (
  <Layout>
    <Inner />
  </Layout>
);

export default SparkLegalAcceptances;
