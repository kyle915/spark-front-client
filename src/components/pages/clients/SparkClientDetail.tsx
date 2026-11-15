/**
 * Spark v2 — Client detail page.
 *
 * The click-through target for a row on the admin Clients list
 * (/clients). It composes the EXISTING per-tenant analytics cards —
 * the same ones the dashboards mount — but scoped to the SPECIFIC
 * client the admin tapped, NOT the admin's own active workspace.
 *
 * Scoping: every per-tenant card takes a `tenantId` prop. On the
 * dashboards that id is `useAuthStore().tenantId` (the viewer's own
 * tenant). Here it is the `:tenantId` route param — which is the
 * `Client.tenantId` the list row routed with. We deliberately do NOT
 * read the auth store: an admin browsing a client must not have to
 * switch their workspace, and the backend resolvers already let
 * admins / @igniteproductions.co query ANY tenant, so passing an
 * arbitrary tenant id works for the admins who see the Clients list.
 *
 * Header name: there is no tenant-by-id query (TenantFiltersInput only
 * filters by name / requestUrlName), so the client's display name is
 * passed via router `state` by the list row for an instant header.
 * Direct navigation / refresh (no state) falls back gracefully to a
 * neutral "Client" label — the analytics still load from the param.
 *
 * Each card is wrapped in its own <Suspense> exactly like the
 * dashboards, so the header paints immediately and each card streams
 * in independently rather than blocking on the slowest fetch.
 */

import React, { Suspense } from "react";
import { Link, useLocation, useParams } from "react-router";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import AskAiButton from "@/components/ai/AskAiButton";
import { askAiSubjectName } from "@/components/ai/askAiSubjectName";
import TenantKpiCharts from "@/components/ai/TenantKpiCharts";
import TenantKpiComparison from "@/components/ai/TenantKpiComparison";
import TenantGoalsPanel from "@/components/ai/TenantGoalsPanel";
import TenantInsightsPanel from "@/components/ai/TenantInsightsPanel";
import WeeklySummaryCard from "@/components/ai/WeeklySummaryCard";
import TenantGeoHeatmap from "@/components/ai/TenantGeoHeatmap";
import TenantBaLeaderboard from "@/components/ai/TenantBaLeaderboard";

// Router state the Clients list row passes so the header has a name
// before (and without) any extra fetch. Optional — direct navigation
// won't have it, hence the fallback in the header.
type ClientDetailState = {
  clientName?: string;
  clientEmail?: string;
};

// Shared Suspense fallback for the per-tenant cards — same calm
// spark-card placeholder the dashboards use.
const CardFallback: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="spark-card p-6 text-center text-sm"
    style={{ color: "var(--spark-text-meta)" }}
  >
    {label}
  </div>
);

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const location = useLocation();
  const state = (location.state as ClientDetailState | null) ?? null;

  const clientName = state?.clientName?.trim() || "Client";
  const clientEmail = state?.clientEmail?.trim() || "";

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Back link to the Clients list. */}
      <Link
        to="/clients"
        className="mono text-[10px] inline-flex items-center gap-1"
        style={{
          letterSpacing: "0.16em",
          color: "var(--spark-text-meta)",
        }}
      >
        ← ALL CLIENTS
      </Link>

      {/* Header — client name from router state (else a graceful
          fallback) + the Ask-AI button scoped to THIS client's tenant. */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            CLIENT
          </p>
          <h1
            className="display text-4xl font-bold mt-2 truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {clientName}
          </h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {clientEmail
              ? `${clientEmail} · program performance, insights & field team.`
              : "Program performance, insights & field team."}
          </p>
        </div>
        {/* Ask AI about THIS client — scoped to the route's tenant id,
            not the viewer's active workspace. */}
        <AskAiButton
          tenantId={tenantId}
          tenantName={askAiSubjectName(state?.clientName)}
        />
      </div>

      {/* Aggregated program KPIs + 12-month trend for this client.
          Own Suspense so the header paints without waiting on the fetch. */}
      <Suspense fallback={<CardFallback label="Loading program KPIs…" />}>
        <TenantKpiCharts tenantId={tenantId} />
      </Suspense>

      {/* Period comparison — each headline KPI this-period vs last-period with
          up/down deltas. Mounted right after the KPI panel; the card renders
          nothing when there's no data for the period. */}
      <Suspense fallback={<CardFallback label="Loading period comparison…" />}>
        <TenantKpiComparison tenantId={tenantId} />
      </Suspense>

      {/* Proactive insight cards for this client. */}
      <Suspense fallback={<CardFallback label="Loading insights…" />}>
        <TenantInsightsPanel tenantId={tenantId} />
      </Suspense>

      <WeeklySummaryCard tenantId={tenantId} />

      {/* Goals & pace-to-target for this client. */}
      <Suspense fallback={<CardFallback label="Loading goals…" />}>
        <TenantGoalsPanel tenantId={tenantId} />
      </Suspense>

      {/* Geographic performance heatmap for this client. */}
      <Suspense
        fallback={<CardFallback label="Loading geographic performance…" />}
      >
        <TenantGeoHeatmap tenantId={tenantId} />
      </Suspense>

      {/* Brand ambassador leaderboard for this client. */}
      <Suspense fallback={<CardFallback label="Loading field team…" />}>
        <TenantBaLeaderboard tenantId={tenantId} />
      </Suspense>
    </div>
  );
};

export default function SparkClientDetail() {
  const { isAdmin } = useSparkRole();
  const { tenantId } = useParams<{ tenantId: string }>();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
            The client detail page is a Spark Admin surface.
          </p>
        </div>
      </Layout>
    );
  }

  if (!tenantId) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-3">
          <h1 className="display text-3xl font-bold">Client not found.</h1>
          <p style={{ color: "var(--spark-text-meta)" }}>
            This link is missing a client reference.
          </p>
          <Link
            to="/clients"
            className="mono text-[10px] inline-flex items-center gap-1"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            ← ALL CLIENTS
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Inner tenantId={tenantId} />
    </Layout>
  );
}
