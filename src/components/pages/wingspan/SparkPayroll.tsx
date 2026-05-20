/**
 * Spark v2 — Payroll · Hours page.
 *
 * Surfaces Wingspan payroll periods (pay cycles) and a small KPI
 * strip. Read-only — Spark doesn't run payroll, just reflects what
 * Wingspan reports.
 */

import React, { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { WingspanPayrollPeriodsQuery } from "@/api/queries/WingspanPayrollPeriodsQuery";
import type { WingspanPayrollPeriodsQuery as WingspanPayrollPeriodsQueryType } from "@api/queries/__generated__/WingspanPayrollPeriodsQuery.graphql";
import { WingspanNotConnected } from "./NotConnected";

type Period = NonNullable<
  WingspanPayrollPeriodsQueryType["response"]["wingspanPayrollPeriods"][number]
>;

const fmtUsd = (n: number | null | undefined) =>
  typeof n === "number"
    ? `$${n.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`
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
  open: "chip chip-orange",
  processing: "chip chip-sky",
  paid: "chip chip-lime",
  failed: "chip chip-muted",
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<WingspanPayrollPeriodsQueryType>(
    WingspanPayrollPeriodsQuery,
    { limit: 12 },
    { fetchPolicy: "store-and-network" },
  );
  const status = data.wingspanStatus;
  const periods = useMemo<Period[]>(
    () =>
      (data.wingspanPayrollPeriods ?? []).filter(
        (p): p is Period => Boolean(p),
      ),
    [data],
  );

  // KPIs from connected data
  const openPeriod = periods.find(
    (p) => (p.status ?? "").toLowerCase() === "open",
  );
  const totalLastPaid = periods
    .filter((p) => (p.status ?? "").toLowerCase() === "paid")
    .slice(0, 1)
    .reduce((s, p) => s + (p.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            PAYROLL · HOURS
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Auto from Wingspan.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            BA payouts run through Wingspan. Spark reflects the most
            recent pay cycles — drill into Payments to see individual
            disbursements.
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
            "Wingspan API key is not set. Once configured, this page populates with real pay cycles."
          }
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="OPEN PERIOD"
              value={openPeriod?.label ?? "—"}
            />
            <Kpi
              label="OPEN TOTAL"
              value={fmtUsd(openPeriod?.totalAmount)}
              highlight
            />
            <Kpi
              label="CONTRACTORS"
              value={openPeriod?.contractorCount ?? "—"}
            />
            <Kpi
              label="LAST PAID"
              value={fmtUsd(totalLastPaid)}
              highlight
            />
          </div>

          {/* Periods table */}
          <div className="spark-card p-0 overflow-hidden">
            <div
              className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1fr] gap-3 px-4 py-3 mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <span>PERIOD</span>
              <span>PAY DATE</span>
              <span>STATUS</span>
              <span>BAs</span>
              <span className="text-right">TOTAL</span>
            </div>
            {periods.length === 0 ? (
              <div
                className="p-8 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No pay cycles returned from Wingspan yet.
              </div>
            ) : (
              periods.map((p) => {
                const cls =
                  STATUS_CHIP[(p.status ?? "").toLowerCase()] ??
                  "chip chip-muted";
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      navigate(`/payments?periodId=${encodeURIComponent(p.id)}`)
                    }
                    className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1fr] gap-3 px-4 py-3 text-sm w-full text-left transition"
                    style={{
                      background: "transparent",
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <span className="font-semibold truncate">
                      {p.label}
                    </span>
                    <span
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      {fmtDate(p.payDate)}
                    </span>
                    <span>
                      <span className={cls}>
                        ● {(p.status ?? "—").toUpperCase()}
                      </span>
                    </span>
                    <span
                      className="tab-num"
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      {p.contractorCount ?? "—"}
                    </span>
                    <span
                      className="tab-num text-right font-semibold"
                      style={{ color: "var(--spark-lime)" }}
                    >
                      {fmtUsd(p.totalAmount)}
                    </span>
                  </button>
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
        color: "rgba(255,255,255,0.45)",
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

export default function SparkPayroll() {
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Payroll is a Spark Admin surface.
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
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading payroll…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
