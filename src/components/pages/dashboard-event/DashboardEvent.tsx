import { Suspense } from "react";
import Layout from "@/layout/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import ActiveTenantAskAi from "@/components/ai/ActiveTenantAskAi";
import AskAiButton from "@/components/ai/AskAiButton";
import ClockSummaryCard from "@/components/dashboard/ClockSummaryCard";
import TodayAttentionPanels, { OnTheSheets } from "@/components/dashboard/TodayAttentionPanels";
import TodayAttentionStrip from "@/components/dashboard/TodayAttentionStrip";
import StaffingGlanceCard from "@/components/dashboard/StaffingGlanceCard";
import SetupChecklistCard from "@/components/dashboard/SetupChecklistCard";
import { InsightsBody } from "@/components/pages/insights/SparkInsights";
import DashboardProgramSwitch from "@/field/DashboardProgramSwitch";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { isTorchTenant } from "@/field/torch";
import { useDashboardProgram } from "@/field/useDashboardProgram";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import { SparkKpiLockup } from "@/shared/SparkStatBlocks";
import { attentionSnapshotKpis } from "@/shared/sparkStat";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { ArrowDown, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import {
  BrandComparePanel,
  BrandViewSwitch,
} from "@/components/brandGroup/BrandCompare";
import { useBrandView } from "@/components/brandGroup/useBrandView";

/**
 * Compact priority-glance card: pending approvals (SLA), recaps due,
 * upcoming 14d, unread alerts. Tremor lockups + CountReel; orange only
 * when attention-worthy. DashWind-ish band spacing.
 *
 * Sourced from useSidebarCounts so tracker / approvals / recaps-due
 * share the sidebar's server scalars — no extra 2,000-row fetch.
 */
const TodaysSnapshot: React.FC = () => {
  const navigate = useNavigate();
  const counts = useSidebarCounts();
  const { tenantSlug, tenantMeta } = useAuthStore();
  const showMissing = showsMissingRecaps(
    tenantSlug,
    tenantMeta?.requestUrlName,
  );
  const allTiles = attentionSnapshotKpis({
    ...counts,
    showMissingRecaps: showMissing,
  });
  const opsClear =
    counts.approvals === 0 &&
    counts.approvalsSlaBreach === 0 &&
    (!showMissing || counts.recapsDue === 0);
  const visibleTiles = opsClear
    ? allTiles.filter((t) => t.label !== "Recaps due")
    : allTiles;

  if (visibleTiles.length === 0 && !opsClear) return null;

  if (opsClear && counts.tracker === 0 && counts.upcoming === 0 && counts.alertsUnread === 0) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium"
        style={{
          background: "var(--spark-ok-bg)",
          color: "var(--spark-ok-ink)",
          border: "1px solid var(--spark-ok-border)",
        }}
      >
        <CheckCircle2 size={14} strokeWidth={1.75} />
        Recaps &amp; approvals clear
      </div>
    );
  }

  return (
    <div className="spark-card spark-stat-band">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="spark-kpi-label">Needs you</p>
        {opsClear ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: "var(--spark-ok-bg)",
              color: "var(--spark-ok-ink)",
              border: "1px solid var(--spark-ok-border)",
            }}
          >
            <CheckCircle2 size={13} strokeWidth={1.75} />
            Recaps &amp; approvals clear
          </span>
        ) : null}
      </div>
      <div className="spark-stat-band-grid">
        {visibleTiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => navigate(t.to)}
            className="text-left transition"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            <SparkKpiLockup {...t} />
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Ops home — due recaps, clock, what needs you, then program
 * performance (pace / KPIs / map) on the same page. Legacy
 * /insights redirects here.
 */

function DashboardInner() {
  const { tenantId, tenantMeta, tenantSlug } = useAuthStore();
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const { program, choose } = useDashboardProgram(torch);
  const { isClient, isAdmin } = useSparkRole();
  const { view, choose: chooseView } = useBrandView();
  const comparing = view === "compare" && !!tenantId;

  const linkedSheetUrl = tenantId
    ? (() => {
        try {
          return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
        } catch {
          return "";
        }
      })()
    : "";

  return (
    <div className="spark-dash spark-scale">
      <div className="spark-dash-top space-y-5 lg:space-y-6">
      <SparkPageHeader
        title="Dashboard"
        support="Due recaps, clock, what needs you — then program performance."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Suspense
              fallback={<AskAiButton tenantId={tenantId} variant="text" />}
            >
              <ActiveTenantAskAi variant="text" />
            </Suspense>
            <BrandViewSwitch
              tenantId={tenantId}
              view={view}
              onChange={chooseView}
            />
            {torch && !comparing ? (
              <DashboardProgramSwitch program={program} onChange={choose} />
            ) : null}
            {linkedSheetUrl ? (
              <a
                href={linkedSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                style={{
                  background: "rgba(95,184,239,0.10)",
                  color: "var(--spark-sky)",
                  border: "1px solid rgba(95,184,239,0.35)",
                  textDecoration: "none",
                }}
                title="Open the brand's linked Google Sheet in a new tab"
              >
                Sheet
                <ArrowUpRight size={14} strokeWidth={1.75} />
              </a>
            ) : null}
            {comparing ? null : (
              <a
                href="#performance"
                className="px-3 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
                style={{
                  background: "transparent",
                  color: "var(--spark-text-secondary)",
                  border: "1px solid var(--spark-border)",
                  textDecoration: "none",
                }}
              >
                Performance
                <ArrowDown size={14} strokeWidth={1.75} />
              </a>
            )}
          </div>
        }
      />

      {comparing && tenantId ? (
        <BrandComparePanel tenantId={tenantId} canManageAccess={isAdmin} />
      ) : (
      <>
      {isAdmin ? (
        <Suspense fallback={null}>
          <SetupChecklistCard key={String(tenantId ?? "")} />
        </Suspense>
      ) : null}

      {program === "field" ? null : (
        <>
          <Suspense fallback={null}>
            <TodaysSnapshot />
          </Suspense>

          {!isClient ? <TodayAttentionStrip /> : null}

          <Suspense fallback={null}>
            <TodayAttentionPanels staff={!isClient} />
          </Suspense>
        </>
      )}
      </>
      )}
      </div>

      {/* Today's working detail. Below the panels on a laptop; a second
          column beside the whole page on a wide monitor, where the page
          used to leave the right third of the screen empty. */}
      {comparing || program === "field" || isClient ? null : (
        <div className="spark-dash-rail space-y-5 lg:space-y-6">
          {isAdmin ? (
            <ErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <OnTheSheets tenantId={tenantId || null} />
              </Suspense>
            </ErrorBoundary>
          ) : null}
          <Suspense fallback={null}>
            <StaffingGlanceCard />
          </Suspense>
          <Suspense fallback={null}>
            <ClockSummaryCard />
          </Suspense>
        </div>
      )}

      {comparing ? null : (
        <div className="spark-dash-rest">
          <Suspense fallback={<DashboardSkeleton />}>
            <InsightsBody embedded />
          </Suspense>
        </div>
      )}
    </div>
  );
}

export default function DashboardIndex() {
  return (
    <Layout>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardInner />
      </Suspense>
    </Layout>
  );
}
