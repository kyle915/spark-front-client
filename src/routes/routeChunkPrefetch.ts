/**
 * Intent-driven route-chunk prefetcher for sidebar & dock links.
 *
 * Calling `prefetchRouteChunk(path)` on `onMouseEnter` / `onFocus` gives the
 * browser a ~100–200ms head start to download secondary page bundles (Shelf &
 * Voice, Program Reports, Buyer Report, Account Map, etc.) before the click
 * lands — with zero static imports added to the root `App` chunk.
 */

type ChunkLoader = () => Promise<unknown>;

const ROUTE_CHUNK_LOADERS: Record<string, ChunkLoader> = {
  "/": () => import("@/components/pages/dashboard-event/DashboardEvent"),
  "/client-dashboard": () =>
    import("@/components/pages/client-dashboard/SparkClientDashboard"),
  "/requests/list": () => import("@/requests/MasterTracker"),
  "/approvals": () => import("@/components/pages/approvals/SparkApprovals"),
  "/my-approvals": () =>
    import("@/components/pages/approvals/SparkClientApprovals"),
  "/recaps/list": () => import("@/recap/SparkRecapsList"),
  "/recaps/missing": () => import("@/recap/SparkRecapsMissing"),
  "/reports": () => import("@/components/pages/reports/SparkReports"),
  "/shelf-voice": () => import("@/components/pages/reports/ShelfVoicePage"),
  "/buyer-report": () => import("@/pilot/BuyerReportPage"),
  "/retailer-pos": () => import("@/pilot/RetailerPosPage"),
  "/demo-costs": () => import("@/pilot/DemoCostsPage"),
  "/roi-pacing": () => import("@/pilot/RoiPacingPage"),
  "/account-map": () => import("@/components/pages/map/SparkAccountMap"),
  "/photos": () => import("@/components/pages/photos/SparkPhotoGallery"),
  "/weekly-summaries": () =>
    import("@/components/pages/weekly-summaries/SparkWeeklySummaries"),
  "/calendar": () => import("@/components/pages/calendar/SparkCalendar"),
  "/upcoming": () => import("@/components/pages/upcoming/SparkUpcomingEvents"),
  "/plans": () => import("@/plans/PlansList"),
  "/walkups": () => import("@/components/pages/walkups/SparkWalkups"),
  "/receipts": () => import("@/components/pages/receipts/SparkReceipts"),
  "/receipt-checks": () =>
    import("@/components/pages/receiptChecks/SparkReceiptChecks"),
  "/timesheet": () => import("@/components/pages/staffing/SparkPayroll"),
  "/jobs": () => import("@/components/pages/jobs/SparkJobs"),
  "/chat": () => import("@/chat/SparkChatPage"),
  "/people": () => import("@/components/pages/people/SparkPeople"),
  "/talent": () => import("@/components/pages/talent/SparkTalent"),
  "/favorites": () => import("@/components/pages/favorites/SparkFavorites"),
  "/academy": () => import("@/components/pages/academy/SparkAcademy"),
  "/announcements": () =>
    import("@/components/pages/announcements/SparkAnnouncements"),
  "/inbox": () => import("@/components/pages/inbox/SparkInbox"),
  "/alerts": () => import("@/components/pages/alerts/SparkAlerts"),
  "/payroll": () => import("@/components/pages/wingspan/SparkPayroll"),
  "/payments": () => import("@/components/pages/wingspan/SparkPayments"),
  "/forms/builder": () => import("@/components/pages/builder/SparkFormBuilder"),
  "/recaps/templates": () => import("@/recap/SparkRecapTemplates"),
  "/clients": () => import("@/components/pages/clients/SparkClients"),
  "/team": () => import("@/components/pages/team/SparkTeam"),
  "/system-health": () =>
    import("@/components/pages/system-health/SparkSystemHealth"),
  "/settings": () => import("@/components/pages/settings/SparkSettings"),
  "/billing": () => import("@/components/pages/billing/SparkBilling"),
  "/help": () => import("@/components/pages/help/SparkHelp"),
  "/ai-connector": () =>
    import("@/components/pages/ai-connector/SparkAiConnector"),
  "/setup-guide": () => import("@/components/pages/help/SparkSetupGuide"),
  "/workspace": () => import("@/pilot/BrandWorkspacePage"),
  "/imports": () => import("@/pilot/ProviderImportsPage"),
  "/finance-queue": () => import("@/pilot/FinanceQueuePage"),
  "/plans-billing": () => import("@/pilot/PlansAndBillingPage"),
  "/field-marketing": () => import("@/field/FieldMarketing"),
  "/requests/bulk-upload": () => import("@/requests/SparkBulkUpload"),
};

const prefetchedPaths = new Set<string>();

/** Strip query string, hash, and trailing slash (preserving "/"). */
export function normalizePrefetchPath(to: string): string {
  const stripped = to.split(/[?#]/, 1)[0].trim();
  if (!stripped) return "";
  if (stripped === "/") return "/";
  return stripped.replace(/\/+$/, "");
}

export function hasRouteChunkPrefetch(to: string): boolean {
  const key = normalizePrefetchPath(to);
  return Boolean(key && key in ROUTE_CHUNK_LOADERS);
}

function isDataSaverEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return Boolean(conn?.saveData);
}

/**
 * Trigger a one-shot dynamic import for `to`'s route chunk.
 * Silently ignores unknown paths, Data Saver mode, and transient network errors.
 */
export function prefetchRouteChunk(
  to: string | null | undefined,
  loaderOverride?: Record<string, ChunkLoader>,
): boolean {
  if (!to || isDataSaverEnabled()) return false;
  const key = normalizePrefetchPath(to);
  if (!key || prefetchedPaths.has(key)) return false;
  const table = loaderOverride ?? ROUTE_CHUNK_LOADERS;
  const loader = table[key];
  if (!loader) return false;
  prefetchedPaths.add(key);
  void loader().catch(() => {
    // Allow retry later if a transient network blip failed the prefetch.
    prefetchedPaths.delete(key);
  });
  return true;
}

export function resetPrefetchedRouteChunks(): void {
  prefetchedPaths.clear();
}
