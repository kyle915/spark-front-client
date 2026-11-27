/**
 * Spark v2 — Payments · Wingspan page.
 *
 * List of individual disbursements (BA payouts) pulled from
 * Wingspan. Optional ?periodId=... query string filters to a single
 * payroll period (the Payroll page passes this when you click a
 * period row).
 */

import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { WingspanPaymentsQuery } from "@/api/queries/WingspanPaymentsQuery";
import type { WingspanPaymentsQuery as WingspanPaymentsQueryType } from "@api/queries/__generated__/WingspanPaymentsQuery.graphql";
import { WingspanNotConnected } from "./NotConnected";

type Payment = NonNullable<
  WingspanPaymentsQueryType["response"]["wingspanPayments"][number]
>;

const fmtUsd = (n: number | null | undefined) =>
  typeof n === "number"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-orange",
  processing: "chip chip-sky",
  sent: "chip chip-lime",
  paid: "chip chip-lime",
  failed: "chip chip-muted",
};

const Inner: React.FC<{ periodId: string | null }> = ({ periodId }) => {
  const [search, setSearch] = useState("");
  const data = useLazyLoadQuery<WingspanPaymentsQueryType>(
    WingspanPaymentsQuery,
    { limit: 100, periodId: periodId ?? undefined },
    { fetchPolicy: "store-and-network" },
  );
  const status = data.wingspanStatus;
  const allPayments = useMemo<Payment[]>(
    () =>
      (data.wingspanPayments ?? []).filter(
        (p): p is Payment => Boolean(p),
      ),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allPayments;
    return allPayments.filter(
      (p) =>
        (p.contractorName ?? "").toLowerCase().includes(q) ||
        (p.contractorEmail ?? "").toLowerCase().includes(q) ||
        (p.memo ?? "").toLowerCase().includes(q),
    );
  }, [allPayments, search]);

  const total = useMemo(
    () => filtered.reduce((s, p) => s + (p.amount ?? 0), 0),
    [filtered],
  );

  const headline = periodId
    ? `Payments in period ${periodId}`
    : "Recent payments.";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            PAYMENTS · WINGSPAN
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {headline}
          </h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Every disbursement we've pulled from Wingspan. To run a
            payout, head to the Wingspan dashboard.
          </p>
        </div>
        <a
          href="https://app.wingspan.app"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
            textDecoration: "none",
          }}
        >
          Open Wingspan ↗
        </a>
      </div>

      {!status?.connected ? (
        <WingspanNotConnected
          message={
            status?.message ??
            "Wingspan API key is not set. Once configured, this page populates with real payouts."
          }
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="ROWS" value={filtered.length} />
            <Kpi label="TOTAL" value={fmtUsd(total)} highlight />
            <Kpi
              label="FILTER"
              value={periodId ? `Period ${periodId}` : "All recent"}
            />
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or memo…"
            className="rounded-xl text-sm w-full max-w-md"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              padding: "0.6rem 0.95rem",
            }}
          />

          <div className="spark-card p-0 overflow-hidden">
            <div
              className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-text-meta)",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <span>BA</span>
              <span>EMAIL</span>
              <span>PAY DATE</span>
              <span>STATUS</span>
              <span className="text-right">AMOUNT</span>
            </div>
            {filtered.length === 0 ? (
              <div
                className="p-8 text-center text-sm"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {allPayments.length === 0
                  ? "No payments returned from Wingspan yet."
                  : "No matches."}
              </div>
            ) : (
              filtered.map((p) => {
                const cls =
                  STATUS_CHIP[(p.status ?? "").toLowerCase()] ??
                  "chip chip-muted";
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-sm"
                    style={{
                      borderTop: "1px solid rgba(var(--spark-ink-rgb),0.04)",
                    }}
                    title={p.memo ?? undefined}
                  >
                    <span className="font-semibold truncate">
                      {p.contractorName ?? "—"}
                    </span>
                    <span
                      className="truncate text-xs"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {p.contractorEmail ?? "—"}
                    </span>
                    <span style={{ color: "var(--spark-text-secondary)" }}>
                      {fmtDate(p.payDate)}
                    </span>
                    <span>
                      <span className={cls}>
                        {(p.status ?? "—").toUpperCase()}
                      </span>
                    </span>
                    <span
                      className="tab-num text-right font-semibold"
                      style={{ color: "var(--spark-lime)" }}
                    >
                      {fmtUsd(p.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="spark-card p-4">
    <p
      className="mono text-[10px]"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-text-meta)",
      }}
    >
      {label}
    </p>
    <p
      className="tab-num text-2xl font-bold mt-1"
      style={{ color: highlight ? "var(--spark-lime)" : undefined }}
    >
      {value}
    </p>
  </div>
);

export default function SparkPayments() {
  const [params] = useSearchParams();
  const periodId = params.get("periodId");
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Payments is a Spark Admin surface.
          </p>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading payments…
          </div>
        }
      >
        <Inner periodId={periodId} />
      </Suspense>
    </Layout>
  );
}
