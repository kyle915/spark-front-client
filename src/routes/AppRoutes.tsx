import {
  ChartBarIcon,
  QueueListIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  Bars4Icon,
  CameraIcon,
  BuildingStorefrontIcon,
  PlusCircleIcon,
  CalendarIcon,
  MapIcon,
  MapPinIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  FlagIcon,
} from "@heroicons/react/24/solid";
import { Palette, PencilIcon, TagIcon, Archive } from "lucide-react";

// Route-level code-splitting.
//
// EVERY route loads with `lazy(() => import(...))` — fetched when the
// route is visited. The router has a single top-level Suspense boundary
// so each route doesn't need its own. The hot paths (tracker, dashboard,
// request views, approvals) are additionally WARMED during browser idle
// via prefetchHotRoutes() below — typically while the user is still on
// the login screen — so they open instantly without being eagerly
// bundled into the entry (eager bundling put ~700KB+ of page code and,
// transitively, the 340KB leaflet vendor chunk into every first paint,
// login page included).
//
// Bundle math: entry ~557KB (~170KB gzip) + vendor-react ~194KB (~61KB
// gzip) + icons at first paint; ~20–300KB per visited route after.
//
// Heavy libraries (xlsx, papaparse, heic2any, leaflet, etc.) ride
// inside their owning lazy chunk, so users who never open Bulk Upload
// or a recap with HEIC photos never download them.

import { lazy, type ComponentType } from "react";
import { Navigate } from "react-router";

// A failed dynamic import almost always means a STALE CHUNK: the tab is still
// running an older index.html (in memory) whose hashed chunk filenames were
// replaced by a newer deploy, so the old file now 404s. That surfaced as the
// Master Tracker (and other routes) "just not loading sometimes" after a deploy
// while the app was open. Recover by reloading once — that pulls the fresh
// index.html + current chunk hashes (index.html is served no-cache). A
// sessionStorage guard prevents a reload LOOP on a genuine (non-stale) failure;
// any successful import clears it so a later deploy can self-heal again.
const CHUNK_RELOAD_KEY = "spark.chunkReloaded";
const importWithReload = async <T,>(loader: () => Promise<T>): Promise<T> => {
  try {
    const mod = await loader();
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* sessionStorage unavailable (private mode) — ignore */
    }
    return mod;
  } catch (err) {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = Boolean(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    } catch {
      /* ignore */
    }
    if (!alreadyReloaded) {
      try {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.reload();
      // Never resolve — keep the route fallback up until the reload swaps the
      // document, instead of flashing an error for a chunk we're abandoning.
      return new Promise<T>(() => {});
    }
    // Already retried once this session — surface the real error.
    throw err;
  }
};

// Preserve the underlying component's prop types through React.lazy.
// Without the explicit C generic the wrapped component would type-check
// as `ComponentType<{}>` and any call site that passes props (e.g.
// `<RequestsList fixedFilters={...} />`) would TS-error.
const lazyDefault = <P,>(
  loader: () => Promise<{ default: ComponentType<P> }>,
) => lazy(() => importWithReload(loader));

const lazyNamed = <T, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) =>
  lazy(async () => {
    const mod = await importWithReload(loader);
    return { default: mod[name] as unknown as ComponentType<unknown> };
  });

import AdminOnly from "@/layout/AdminOnly";

// ─── Hot paths: lazy chunks + idle-time prefetch ──────────────────────
// These were eagerly bundled into the entry "so the initial bundle is hot",
// but that dragged ~700KB into EVERY first paint — including the login
// screen — and SparkRequestView's LocationMap pulled the whole 340KB
// leaflet vendor chunk in with it. Lazy + prefetch keeps first paint
// light while the tracker/dashboard still open instantly: the loaders
// below are kicked off during browser idle right after boot (see
// prefetchHotRoutes), so by the time anyone clicks, the chunk is cached.
const loadDashboardEvents = () =>
  import("@/components/pages/dashboard-event/DashboardEvent");
const loadMasterTracker = () => import("@/requests/MasterTracker");
const loadSparkRequestView = () => import("@/requests/SparkRequestView");
const loadSparkRequestEdit = () => import("@/requests/SparkRequestEdit");
const loadSparkApprovals = () =>
  import("@/components/pages/approvals/SparkApprovals");
const loadSparkRequestCreate = () => import("@/requests/SparkRequestCreate");
const loadSparkRecapsList = () => import("@/recap/SparkRecapsList");
const loadRecapCustomView = () => import("@/recap/RecapCustomView");

const DashboardEvents = lazyDefault(loadDashboardEvents);
const MasterTracker = lazyDefault(loadMasterTracker);
const SparkRequestView = lazyDefault(loadSparkRequestView);
const SparkRequestEdit = lazyDefault(loadSparkRequestEdit);
const SparkApprovals = lazyDefault(loadSparkApprovals);
const SparkRequestCreate = lazyDefault(loadSparkRequestCreate);

/** Warm the hot-path chunks during browser idle so the first click on
 * Tracker / a request / the dashboard hits a cached module instead of the
 * network. Fired once from App boot, AFTER first paint — failures are
 * irrelevant (the route falls back to loading on demand). */
export function prefetchHotRoutes(): void {
  const warm = () => {
    loadDashboardEvents().catch(() => {});
    loadMasterTracker().catch(() => {});
    loadSparkRequestView().catch(() => {});
    loadSparkRequestEdit().catch(() => {});
    loadSparkApprovals().catch(() => {});
    loadSparkRequestCreate().catch(() => {});
    loadSparkRecapsList().catch(() => {});
    loadRecapCustomView().catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 4000 });
  } else {
    setTimeout(warm, 1500);
  }
}

// ─── Lazy: dashboard variants, all leaf routes ────────────────────────
const DashboardRetail = lazyDefault(
  () => import("@/components/pages/dashboard-retail/DashboardRetail"),
);
// Requests (legacy)
const RequestsList = lazyDefault(() => import("@/requests/RequestsList"));
const RequestView = lazyDefault(() => import("@/requests/RequestView"));
const EditRequest = lazyDefault(() => import("@/requests/EditRequest"));
const CreateRequest = lazyDefault(() => import("@/requests/CreateRequest"));

// Events
const EventsList = lazyDefault(() => import("@/events/EventsList"));
const CreateEvent = lazyDefault(() => import("@/events/CreateEvent"));
const EditEvent = lazyDefault(() => import("@/events/EditEvent"));
const EventView = lazyDefault(() => import("@/events/EventView"));
const SparkEventView = lazyDefault(() => import("@/events/SparkEventView"));
const TodayEvents = lazyDefault(() => import("@/events/TodayEvents"));
const TodayEventsMap = lazyDefault(() => import("@/events/TodayEventsMap"));
const CreateEventWithoutRequest = lazyDefault(
  () => import("@/events/CreateEventWithoutRequest"),
);

// Products
const ProductsList = lazyDefault(() => import("@/products/ProductsList"));
const CreateProduct = lazyDefault(() => import("@/products/CreateProduct"));

// Catalogs — each module exports multiple components; use lazyNamed.
const ProductTypesList = lazyNamed(
  () => import("@/catalogs/ProductTypes"),
  "ProductTypesList",
);
const CreateProductType = lazyNamed(
  () => import("@/catalogs/ProductTypes"),
  "CreateProductType",
);
const EditProductType = lazyNamed(
  () => import("@/catalogs/ProductTypes"),
  "EditProductType",
);
const EventTypesList = lazyNamed(
  () => import("@/catalogs/EventTypes"),
  "EventTypesList",
);
const CreateEventType = lazyNamed(
  () => import("@/catalogs/EventTypes"),
  "CreateEventType",
);
const EditEventType = lazyNamed(
  () => import("@/catalogs/EventTypes"),
  "EditEventType",
);
const LocationsList = lazyNamed(
  () => import("@/catalogs/Locations"),
  "LocationsList",
);
const CreateLocation = lazyNamed(
  () => import("@/catalogs/Locations"),
  "CreateLocation",
);
const EditLocation = lazyNamed(
  () => import("@/catalogs/Locations"),
  "EditLocation",
);
const RequestTypesList = lazyNamed(
  () => import("@/catalogs/RequestTypes"),
  "RequestTypesList",
);
const CreateRequestType = lazyNamed(
  () => import("@/catalogs/RequestTypes"),
  "CreateRequestType",
);
const EditRequestType = lazyNamed(
  () => import("@/catalogs/RequestTypes"),
  "EditRequestType",
);
const DistributorsList = lazyNamed(
  () => import("@/catalogs/Distributors"),
  "DistributorsList",
);
const CreateDistributor = lazyNamed(
  () => import("@/catalogs/Distributors"),
  "CreateDistributor",
);
const EditDistributor = lazyNamed(
  () => import("@/catalogs/Distributors"),
  "EditDistributor",
);
const RetailersList = lazyNamed(
  () => import("@/catalogs/Retailers"),
  "RetailersList",
);
const CreateRetailer = lazyNamed(
  () => import("@/catalogs/Retailers"),
  "CreateRetailer",
);
const EditRetailer = lazyNamed(
  () => import("@/catalogs/Retailers"),
  "EditRetailer",
);

// Recap (heaviest — pulls HEIC decoder via dynamic import)
const RecapList = lazyDefault(() => import("@/recap/RecapsList"));
const SparkRecapsList = lazyDefault(loadSparkRecapsList);
const SparkRecapsMissing = lazyDefault(
  () => import("@/recap/SparkRecapsMissing"),
);
const SparkRecapView = lazyDefault(() => import("@/recap/SparkRecapView"));
const SparkRecapCreate = lazyDefault(() => import("@/recap/SparkRecapCreate"));
const SparkRecapTemplates = lazyDefault(
  () => import("@/recap/SparkRecapTemplates"),
);
const SparkClientDashboard = lazyDefault(
  () =>
    import("@/components/pages/client-dashboard/SparkClientDashboard"),
);
const SparkRecapTemplateCreate = lazyDefault(
  () =>
    import(
      "@/components/pages/recap-templates/SparkRecapTemplateCreate"
    ),
);
const SparkRecapTemplateEdit = lazyDefault(
  () =>
    import(
      "@/components/pages/recap-templates/SparkRecapTemplateEdit"
    ),
);
const RecapCustomList = lazyDefault(() => import("@/recap/RecapCustomList"));
const RecapView = lazyDefault(() => import("@/recap/RecapView"));
const RecapCustomView = lazyDefault(loadRecapCustomView);
// Client-facing recap sign-off list (/my-approvals). The clean counterpart
// to the admin /approvals ops queue — see SparkClientApprovals for why it's
// list-only and how it's tenant-scoped.
const SparkClientApprovals = lazyDefault(
  () => import("@/components/pages/approvals/SparkClientApprovals"),
);

// Calendar / Scheduling
const SparkCalendar = lazyDefault(
  () => import("@/components/pages/calendar/SparkCalendar"),
);

// Settings + admin
const SparkSettings = lazyDefault(
  () => import("@/components/pages/settings/SparkSettings"),
);
const SparkJobs = lazyDefault(
  () => import("@/components/pages/jobs/SparkJobs"),
);
const SparkBulkUpload = lazyDefault(() => import("@/requests/SparkBulkUpload"));
const SparkReports = lazyDefault(
  () => import("@/components/pages/reports/SparkReports"),
);
const SparkInsights = lazyDefault(
  () => import("@/components/pages/insights/SparkInsights"),
);
const SparkInbox = lazyDefault(
  () => import("@/components/pages/inbox/SparkInbox"),
);
const SparkAlerts = lazyDefault(
  () => import("@/components/pages/alerts/SparkAlerts"),
);
const SparkTalent = lazyDefault(
  () => import("@/components/pages/talent/SparkTalent"),
);
const SparkJobDetail = lazyDefault(
  () => import("@/components/pages/jobs/SparkJobDetail"),
);
const SparkAccountMap = lazyDefault(
  () => import("@/components/pages/map/SparkAccountMap"),
);
const SparkToday = lazyDefault(
  () => import("@/components/pages/today/SparkToday"),
);
const SparkUpcomingEvents = lazyDefault(
  () => import("@/components/pages/upcoming/SparkUpcomingEvents"),
);
const SparkRecentSubmissions = lazyDefault(
  () => import("@/components/pages/recent/SparkRecentSubmissions"),
);
const SparkPeople = lazyDefault(
  () => import("@/components/pages/people/SparkPeople"),
);
const SparkSystemHealth = lazyDefault(
  () => import("@/components/pages/system-health/SparkSystemHealth"),
);
const SparkPendingAmbassadors = lazyDefault(
  () => import("@/components/pages/people/SparkPendingAmbassadors"),
);
const SparkFormBuilder = lazyDefault(
  () => import("@/components/pages/builder/SparkFormBuilder"),
);
const SparkNewClient = lazyDefault(
  () => import("@/components/pages/clients/SparkNewClient"),
);
const SparkAcademy = lazyDefault(
  () => import("@/components/pages/academy/SparkAcademy"),
);
const SparkAcademyViewer = lazyDefault(
  () => import("@/components/pages/academy/SparkAcademyViewer"),
);
const SparkAcademyManage = lazyDefault(
  () => import("@/components/pages/academy/SparkAcademyManage"),
);
const SparkChatPage = lazyDefault(() => import("@/chat/SparkChatPage"));
const SparkAnnouncements = lazyDefault(
  () => import("@/components/pages/announcements/SparkAnnouncements"),
);
const SparkTeam = lazyDefault(
  () => import("@/components/pages/team/SparkTeam"),
);
const SparkClients = lazyDefault(
  () => import("@/components/pages/clients/SparkClients"),
);
const SparkClientDetail = lazyDefault(
  () => import("@/components/pages/clients/SparkClientDetail"),
);
const SparkHelp = lazyDefault(
  () => import("@/components/pages/help/SparkHelp"),
);
const SparkFavorites = lazyDefault(
  () => import("@/components/pages/favorites/SparkFavorites"),
);
const SparkPayroll = lazyDefault(
  () => import("@/components/pages/wingspan/SparkPayroll"),
);
const SparkPayments = lazyDefault(
  () => import("@/components/pages/wingspan/SparkPayments"),
);
const SparkBilling = lazyDefault(
  () => import("@/components/pages/billing/SparkBilling"),
);
const SparkPnl = lazyDefault(() => import("@/components/pages/pnl/SparkPnl"));
const SparkFieldSamplingReport = lazyDefault(
  () => import("@/components/pages/field-sampling-report/SparkFieldSamplingReport"),
);
const SparkReceipts = lazyDefault(
  () => import("@/components/pages/receipts/SparkReceipts"),
);
const SparkWalkups = lazyDefault(
  () => import("@/components/pages/walkups/SparkWalkups"),
);
const FieldMarketing = lazyDefault(() => import("@/field/FieldMarketing"));
const SparkStaffingBoard = lazyDefault(
  () => import("@/components/pages/staffing/SparkStaffingBoard"),
);
const SparkLiveBoard = lazyDefault(
  () => import("@/components/pages/staffing/SparkLiveBoard"),
);
const SparkEventConfirmation = lazyDefault(
  () => import("@/components/pages/staffing/SparkEventConfirmation"),
);
const SparkTimesheet = lazyDefault(
  () => import("@/components/pages/staffing/SparkPayroll"),
);
const SparkCampaignCost = lazyDefault(
  () => import("@/components/pages/staffing/SparkCampaignCost"),
);
const SparkClientLive = lazyDefault(
  () => import("@/components/pages/staffing/SparkClientLive"),
);
// Public, no-login web check-in — a BA clocks in/out + files the full recap for
// one event via a shareable link carrying the event's walk-up code.
const SparkCheckin = lazyDefault(
  () => import("@/components/pages/checkin/SparkCheckin"),
);
// Authenticated campaign report view (per-request). Linked from the Master
// Tracker "Report" row action. Public twin is /report/:token below.
const CampaignReportAdminView = lazyDefault(
  () => import("@/reports/CampaignReportAdminView"),
);

// User
const UsersList = lazyDefault(() => import("@/users/UsersList"));
const CreateUser = lazyDefault(() => import("@/users/CreateUser"));

// Public
const SparkFormPage = lazyDefault(() => import("@/public/form/FormPage"));
const SparkPublicExpressForm = lazyDefault(
  () => import("@/public/form/SparkPublicExpressForm"),
);
const PublicApprove = lazyDefault(() => import("@/public/approve/PublicApprove"));
// Public, no-login BA training hub. A brand's BAs usually aren't Spark users
// when training matters, so the :code in the link is the only credential.
const TrainingHub = lazyDefault(() => import("@/public/training/TrainingHub"));
const ReceiptUpload = lazyDefault(() => import("@/public/receipts/ReceiptUpload"));
const CampaignUpload = lazyDefault(
  () => import("@/public/receipts/CampaignUpload"),
);
// Public, no-login shareable campaign report. The signed :token in the URL
// is the auth — fetches the no-auth REST report endpoint and renders the
// same <CampaignReportView> the admin view uses.
const PublicCampaignReport = lazyDefault(
  () => import("@/public/reports/PublicCampaignReport"),
);
// Public, no-login shareable recap. The signed :token is the auth —
// fetches GET /api/public/recap/<token>. Path is /r/:token so it
// does not collide with /recap/list, /recap/create, /recap/view/:uuid.
const PublicRecap = lazyDefault(
  () => import("@/public/recaps/PublicRecap"),
);
// Public, no-login invoice page. The :token in the URL is the auth (no
// tenant guard, like /c/:slug and /report/:token). Fetches the no-auth REST
// invoice endpoint; renders a clean branded invoice + a Download-PDF button.
const PublicInvoice = lazyDefault(
  () => import("@/public/billing/PublicInvoice"),
);
const MagicLinkExchange = lazyDefault(() => import("@/auth/MagicLinkExchange"));
const ForgotPassword = lazyDefault(() => import("@/auth/ForgotPassword"));
const ResetPassword = lazyDefault(() => import("@/auth/ResetPassword"));
const PrivacyPolicyView = lazyDefault(
  () => import("@/utils/PrivacyPolicyView"),
);
const TermsOfServiceView = lazyDefault(
  () => import("@/utils/TermsOfServiceView"),
);
const IndependentContractorAgreementPage = lazyDefault(
  () => import("@/utils/IndependentContractorAgreement"),
);

// Calendar
const CalendarConnection = lazyDefault(
  () => import("@/calendar/CalendarConnection"),
);

// Theme / Goals / Plans
const ThemePage = lazyDefault(() => import("@/theme/ThemePage"));
const CreateGoals = lazyDefault(() => import("@/goals/CreateGoals"));
const GoalsList = lazyDefault(() => import("@/goals/GoalsList"));
const PlansList = lazyDefault(() => import("@/plans/PlansList"));
const PlanDetail = lazyDefault(() => import("@/plans/PlanDetail"));

/* -----------------------------------------------------------
   PUBLIC ROUTES (NO AUTH REQUIRED)
----------------------------------------------------------- */
const PublicRoutes = {
  routes: [
    {
      path: "/spark-form/:tenantSlug",
      component: <SparkPublicExpressForm />,
      isPublic: true,
    },
    {
      path: "/magic/:token",
      component: <MagicLinkExchange />,
      isPublic: true,
    },
    // Public, token-authenticated approval page. Linked from the
    // `Review & approve` button in `rmm_assigned_request` emails — no
    // login required, the signed token in the URL is the auth.
    {
      path: "/approve/:token",
      component: <PublicApprove />,
      isPublic: true,
    },
    // Public, token-authenticated consumer receipt upload page. The token
    // in the URL is minted per-event by the admin Receipts page
    // (eventReceiptUploadLink) and is the auth — no login, no tenant
    // guard. Submissions land in the admin Receipts validation queue.
    {
      path: "/receipt-upload/:token",
      component: <ReceiptUpload />,
      isPublic: true,
    },
    // Public, no-login consumer rebate upload page. The :slug identifies an
    // always-on per-client receipt campaign (no token, no tenant guard — a
    // missing or inactive campaign 404s server-side). Consumers upload a
    // receipt + their PayPal handle; submissions land in the per-campaign
    // queue on the admin Receipts dashboard.
    {
      path: "/c/:slug",
      component: <CampaignUpload />,
      isPublic: true,
    },
    // Public, no-login shareable campaign report. The signed :token in the
    // URL is the auth (no tenant guard, like /c/:slug). Fetches the no-auth
    // REST report endpoint; renders the shared <CampaignReportView> + a
    // Download-PDF button.
    {
      path: "/report/:token",
      component: <PublicCampaignReport />,
      isPublic: true,
    },
    {
      path: "/r/:token",
      component: <PublicRecap />,
      isPublic: true,
    },
    // Public, no-login invoice page. The :token is the auth (no tenant
    // guard, like /report/:token). Fetches the no-auth REST invoice
    // endpoint and renders a clean branded invoice + Download-PDF button.
    {
      path: "/invoice/:token",
      component: <PublicInvoice />,
      isPublic: true,
    },
    {
      path: "/forgot-password",
      component: <ForgotPassword />,
      isPublic: true,
    },
    {
      path: "/reset-password/:token",
      component: <ResetPassword />,
      isPublic: true,
    },
    {
      path: "/spark-form-legacy/:tenantSlug",
      component: <SparkFormPage />,
      isPublic: true,
    },
    {
      path: "/privacy-policy",
      component: <PrivacyPolicyView />,
      isPublic: true,
    },
    {
      path: "/independent-contractor-agreement",
      component: <IndependentContractorAgreementPage />,
      isPublic: true,
    },
    {
      path: "/terms-of-service",
      component: <TermsOfServiceView />,
      isPublic: true,
    },
  ],
};

/* -----------------------------------------------------------
   DASHBOARD
----------------------------------------------------------- */
const DashboardLinks = {
  menu: [
    { path: "/", name: "Events", Icon: ChartBarIcon },
    { path: "/retail-dashboard", name: "Retail", Icon: QueueListIcon },
  ],

  routes: [
    { path: "/", component: <DashboardEvents />, isPublic: false },
    {
      path: "/retail-dashboard",
      component: <DashboardRetail />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   REQUESTS
----------------------------------------------------------- */
const RequestsLinks = {
  menu: [
    { path: "/requests/create", name: "Create", Icon: PlusCircleIcon },
    { path: "/requests/list", name: "List", Icon: Bars4Icon },
    { path: "/requests/edited", name: "Edited Requests", Icon: PencilIcon },
  ],

  routes: [
    {
      path: "/requests/list",
      component: <MasterTracker />,
      isPublic: false,
    },
    {
      path: "/requests/legacy",
      component: <RequestsList />,
      isPublic: false,
    },
    {
      path: "/requests/create",
      component: <SparkRequestCreate />,
      isPublic: false,
    },
    {
      path: "/requests/bulk-upload",
      component: <SparkBulkUpload />,
      isPublic: false,
    },
    {
      path: "/requests/create-detailed",
      component: <CreateRequest />,
      isPublic: false,
    },
    {
      path: "/request/view/:uuid",
      component: <SparkRequestView />,
      isPublic: false,
    },
    {
      // Legacy old-chrome view, kept around for any deep links that
      // depend on the older RequestCard layout. Linked nowhere in
      // the v2 nav.
      path: "/request/view-legacy/:uuid",
      component: <RequestView />,
      isPublic: false,
    },
    {
      path: "/request/edit/:uuid",
      component: <SparkRequestEdit />,
      isPublic: false,
    },
    {
      // Legacy full edit form, reachable from the v2 edit page's
      // 'Edit in full form' link when products/details need work.
      path: "/request/edit-legacy/:uuid",
      component: <EditRequest />,
      isPublic: false,
    },
    {
      path: "/requests/edited",
      component: <RequestsList fixedFilters={{ edited: true }} />,
      isPublic: false,
    },
    {
      path: "/approvals",
      component: (
        <AdminOnly>
          <SparkApprovals />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Client-facing recap sign-off list. NOT AdminOnly — clients land
      // here from the sidebar "Approvals" item (clientTo: /my-approvals)
      // while admins keep the /approvals ops queue. Auth-gated; the page
      // reads only the tenant-scoped recaps/customRecaps queries and the
      // backend forces a client to their own tenant, so it's safe to
      // expose (mirrors /account-map, /today).
      path: "/my-approvals",
      component: <SparkClientApprovals />,
      isPublic: false,
    },
    {
      path: "/jobs",
      component: (
        <AdminOnly>
          <SparkJobs />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/insights",
      component: <SparkInsights />,
      isPublic: false,
    },
    {
      path: "/reports",
      component: <SparkReports />,
      isPublic: false,
    },
    {
      // Authenticated, tenant-guarded campaign report for one request.
      // Reached from the Master Tracker "Report" row action. Public twin
      // is /report/:token (no auth).
      path: "/report-view/:requestId",
      component: <CampaignReportAdminView />,
      isPublic: false,
    },
    {
      path: "/inbox",
      component: <SparkInbox />,
      isPublic: false,
    },
    {
      path: "/alerts",
      component: <SparkAlerts />,
      isPublic: false,
    },
    {
      path: "/chat",
      component: <SparkChatPage />,
      isPublic: false,
    },
    {
      path: "/announcements",
      component: <SparkAnnouncements />,
      isPublic: false,
    },
    {
      path: "/talent",
      component: (
        <AdminOnly>
          <SparkTalent />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/job/view/:uuid",
      component: <SparkJobDetail />,
      isPublic: false,
    },
    {
      // Client-visible: the page only reads the tenant-scoped
      // RequestsQuery and the backend forces clients to their own
      // tenant, so no AdminOnly gate is needed (mirrors /today,
      // /upcoming which are likewise tenant-scoped client surfaces).
      path: "/account-map",
      component: <SparkAccountMap />,
      isPublic: false,
    },
    { path: "/today", component: <SparkToday />, isPublic: false },
    { path: "/upcoming", component: <SparkUpcomingEvents />, isPublic: false },
    {
      // Client-visible: SparkRecentSubmissions only reads the
      // tenant-scoped RequestsQuery and the backend forces clients to
      // their own tenant, so no AdminOnly gate is needed (mirrors
      // /account-map, /today, /upcoming). The nav flag was dropped in the
      // F8 fix; this removes the leftover route-level guard that still
      // showed clients "ADMIN VIEW REQUIRED".
      path: "/recent",
      component: <SparkRecentSubmissions />,
      isPublic: false,
    },
    {
      // Cost lens: labor (clock pairs × booked rates) + receipt spend
      // per event. Ignite-internal.
      path: "/pnl",
      component: (
        <AdminOnly>
          <SparkPnl />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Consolidated samples/hour + SKU + locations + upcoming + call-outs
      // rollup for guerrilla field-sampling programs (Feel Free). Client-
      // visible (mirrors /account-map, /today, /upcoming, /recent): the
      // backend resolves the tenant server-side for non-admins, so a
      // client can only ever see their own tenant's data — no AdminOnly
      // gate needed.
      path: "/field-sampling-report",
      component: <SparkFieldSamplingReport />,
      isPublic: false,
    },
    {
      // Consumer receipt validation queue. Admin-only — distinct from
      // /recaps. Lists consumer-submitted receipts and lets ops mint
      // per-event public upload links that feed this queue.
      path: "/receipts",
      component: (
        <AdminOnly>
          <SparkReceipts />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Walk-up self-serve clock-ins queue. Admin-only — ops confirm/reject
      // clock-ins created from an event code (no prior assignment).
      path: "/walkups",
      component: (
        <AdminOnly>
          <SparkWalkups />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/field-marketing",
      component: <FieldMarketing />,
      isPublic: false,
    },
    {
      // Staffing Board — week grid of shifts × dates; assign gaps in a click.
      path: "/schedule",
      component: (
        <AdminOnly>
          <SparkStaffingBoard />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Live "on the clock" board — today's shifts + who's working now.
      path: "/live-board",
      component: (
        <AdminOnly>
          <SparkLiveBoard />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Send a BA their event confirmation from staffing@, plus the
      // automatic 24h/3h re-sends.
      path: "/event-confirmation",
      component: (
        <AdminOnly>
          <SparkEventConfirmation />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Payroll timesheet — per-BA worked hours + est pay + CSV.
      path: "/timesheet",
      component: (
        <AdminOnly>
          <SparkTimesheet />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Campaign cost & margin — per-brand labor + spend, + admin-entered revenue.
      path: "/campaign-cost",
      component: (
        <AdminOnly>
          <SparkCampaignCost />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Public, no-login branded client-live page (signed token = auth).
      path: "/live/:token",
      component: <SparkClientLive />,
      isPublic: true,
    },
    {
      // Public, no-login BA web check-in for one event (walk-up code = link).
      path: "/checkin/:code",
      component: <SparkCheckin />,
      isPublic: true,
    },
    {
      // Public, no-login BA training hub (guide + video + product sheets).
      path: "/training/:code",
      component: <TrainingHub />,
      isPublic: true,
    },
    {
      path: "/system-health",
      component: (
        <AdminOnly>
          <SparkSystemHealth />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/people",
      component: (
        <AdminOnly>
          <SparkPeople />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/people/pending",
      component: (
        <AdminOnly>
          <SparkPendingAmbassadors />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/forms/builder",
      component: (
        <AdminOnly>
          <SparkFormBuilder />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/clients/new",
      component: (
        <AdminOnly>
          <SparkNewClient />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      // Retired: the old BA portal/detail used a stale ambassadorProfile
      // query (no college/bio/gig-history/photos/résumé; DM + favorite
      // were stubbed). The complete BA surface is now /talent (SparkTalent
      // + BAProfileModal), so both /ba routes redirect there.
      path: "/ba",
      component: <Navigate to="/talent" replace />,
      isPublic: false,
    },
    {
      // Retired → /talent (see /ba above). The talent roster opens each
      // BA's full profile in a modal on click.
      path: "/ba/:uuid",
      component: <Navigate to="/talent" replace />,
      isPublic: false,
    },
    {
      path: "/academy",
      component: <SparkAcademy />,
      isPublic: false,
    },
    {
      path: "/academy/manage",
      component: <SparkAcademyManage />,
      isPublic: false,
    },
    {
      path: "/academy/:id",
      component: <SparkAcademyViewer />,
      isPublic: false,
    },
    {
      path: "/team",
      component: <SparkTeam />,
      isPublic: false,
    },
    {
      path: "/clients",
      component: <SparkClients />,
      isPublic: false,
    },
    {
      // Per-client detail (admin). Click-through from a /clients row.
      // The :tenantId is the row's Client.tenantId; the page composes
      // the existing per-tenant analytics cards scoped to it. Static
      // /clients/new is registered above and out-ranks this dynamic
      // segment in react-router, so "new" never hits this route.
      path: "/clients/:tenantId",
      component: (
        <AdminOnly>
          <SparkClientDetail />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/help",
      component: <SparkHelp />,
      isPublic: false,
    },
    {
      path: "/favorites",
      component: <SparkFavorites />,
      isPublic: false,
    },
    {
      path: "/payroll",
      component: <SparkPayroll />,
      isPublic: false,
    },
    {
      path: "/payments",
      component: <SparkPayments />,
      isPublic: false,
    },
    {
      path: "/billing",
      component: <SparkBilling />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   EVENTS
----------------------------------------------------------- */
const EventsLinks = {
  menu: [
    {
      path: "/event/create",
      name: "Create",
      component: <CreateEventWithoutRequest />,
      Icon: PlusCircleIcon,
    },
    { path: "/events/list", name: "List", Icon: Bars4Icon },
    { path: "/events/edited", name: "Edited Events", Icon: PencilIcon },
    { path: "/events/today", name: "Today", Icon: CalendarIcon },
    { path: "/events/map", name: "Map", Icon: MapIcon },
    { path: "/events/archived", name: "Archived", Icon: Archive },
  ],

  routes: [
    { path: "/events/list", component: <EventsList />, isPublic: false },
    {
      path: "/events/edited",
      component: <EventsList fixedFilters={{ edited: true }} />,
      isPublic: false,
    },
    { path: "/events/today", component: <TodayEvents />, isPublic: false },
    { path: "/events/map", component: <TodayEventsMap />, isPublic: false },
    {
      path: "/events/archived",
      component: <EventsList fixedFilters={{ archived: true }} />,
      isPublic: false,
    },
    {
      path: "/event/create",
      name: "Create Event",
      component: <CreateEventWithoutRequest />,
      isPublic: false,
    },
    {
      path: "/event/create/:uuid",
      component: <CreateEvent />,
      isPublic: false,
    },
    { path: "/event/view/:uuid", component: <SparkEventView />, isPublic: false },
    { path: "/event/view-legacy/:uuid", component: <EventView />, isPublic: false },
    { path: "/event/edit/:uuid", component: <EditEvent />, isPublic: false },
  ],
};

/* -----------------------------------------------------------
 USERS
----------------------------------------------------------- */
const UsersLinks = {
  menu: [
    {
      path: "/users/list",
      name: "List",
      component: <UsersList />,
      Icon: Bars4Icon,
    },
    {
      path: "/users/create",
      name: "Create",
      component: <CreateUser />,
      Icon: PlusCircleIcon,
    },
  ],
  routes: [
    {
      path: "/users/list",
      component: <UsersList />,
      isPublic: false,
    },
    {
      path: "/users/create",
      component: <CreateUser />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   PRODUCTS
----------------------------------------------------------- */
const ProductLinks = {
  menu: [
    { path: "/products/products-list", name: "List", Icon: Bars4Icon },
    { path: "/products/create-product", name: "Create", Icon: PlusCircleIcon },
  ],

  routes: [
    {
      path: "/products/create-product",
      component: <CreateProduct />,
      isPublic: false,
    },
    {
      path: "/products/products-list",
      component: <ProductsList />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   RECAPS
----------------------------------------------------------- */
const RecapLinks = {
  menu: [
    { path: "/recap/list", name: "List", Icon: Bars4Icon },
    { path: "/recap/create", name: "New Recap", Icon: PlusCircleIcon },
    { path: "/recaps/custom-list", name: "Custom List", Icon: QueueListIcon },
  ],

  routes: [
    { path: "/recap/create", component: <SparkRecapCreate />, isPublic: false },
    { path: "/recap/list", component: <SparkRecapsList />, isPublic: false },
    { path: "/recaps/list", component: <SparkRecapsList />, isPublic: false },
    { path: "/recaps/missing", component: <SparkRecapsMissing />, isPublic: false },
    { path: "/recaps/templates", component: <AdminOnly><SparkRecapTemplates /></AdminOnly>, isPublic: false },
    {
      path: "/recaps/templates/new",
      component: (
        <AdminOnly>
          <SparkRecapTemplateCreate />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/recap-templates/new",
      component: (
        <AdminOnly>
          <SparkRecapTemplateCreate />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/recap-templates/:uuid/edit",
      component: (
        <AdminOnly>
          <SparkRecapTemplateEdit />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/client-dashboard",
      component: <SparkClientDashboard />,
      isPublic: false,
    },
    {
      path: "/client",
      component: <SparkClientDashboard />,
      isPublic: false,
    },
    { path: "/recap/legacy", component: <RecapList />, isPublic: false },
    {
      path: "/recaps/custom-list",
      component: <RecapCustomList />,
      isPublic: false,
    },
    { path: "/recap/view/:uuid", component: <SparkRecapView />, isPublic: false },
    { path: "/recap/view-legacy/:uuid", component: <RecapView />, isPublic: false },
    {
      path: "/recap/view-custom/:uuid",
      component: <RecapCustomView />,
      isPublic: false,
    },
    // { path: "/recap/edit/:uuid", component: <EditRecap />, isPublic: false },
  ],
};

/* -----------------------------------------------------------
   Catalogs
----------------------------------------------------------- */
const CatalogsLinks = {
  menu: [
    {
      name: "Product Types",
      Icon: TagIcon,
      links: [
        {
          path: "/catalogs/product-types/list",
          name: "List",
          component: <ProductTypesList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/product-types/create",
          name: "Create",
          component: <CreateProductType />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },
    {
      name: "Event Types",
      Icon: CalendarDaysIcon,
      links: [
        {
          path: "/catalogs/event-types/list",
          name: "List",
          component: <EventTypesList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/event-types/create",
          name: "Create",
          component: <CreateEventType />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },
    {
      name: "Locations",
      Icon: MapPinIcon,
      links: [
        {
          path: "/catalogs/locations/list",
          name: "List",
          component: <LocationsList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/locations/create",
          name: "Create",
          component: <CreateLocation />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Request Types",
      Icon: ClipboardDocumentListIcon,
      links: [
        {
          path: "/catalogs/request-types/list",
          name: "List",
          component: <RequestTypesList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/request-types/create",
          name: "Create",
          component: <CreateRequestType />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Distributors",
      Icon: UserGroupIcon,
      links: [
        {
          path: "/catalogs/distributors/list",
          name: "List",
          component: <DistributorsList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/distributors/create",
          name: "Create",
          component: <CreateDistributor />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Retailers",
      Icon: BuildingStorefrontIcon,
      links: [
        {
          path: "/catalogs/retailers/list",
          name: "List",
          component: <RetailersList />,
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/retailers/create",
          name: "Create",
          component: <CreateRetailer />,
          isPublic: false,
          Icon: PlusCircleIcon,
        },
      ],
    },
  ],
  routes: [
    // products types
    {
      path: "/catalogs/product-types/edit/:uuid",
      name: "Edit Product Type",
      component: <EditProductType />,
      isPublic: false,
    },
    {
      path: "/catalogs/product-types/create",
      name: "Create Product Type",
      component: <CreateProductType />,
      isPublic: false,
    },
    {
      path: "/catalogs/product-types/list",
      name: "List Product Types",
      component: <ProductTypesList />,
      isPublic: false,
    },

    // event types
    {
      path: "/catalogs/event-types/edit/:uuid",
      name: "Edit Event Type",
      component: <EditEventType />,
      isPublic: false,
    },
    {
      path: "/catalogs/event-types/create",
      name: "Create Event Type",
      component: <CreateEventType />,
      isPublic: false,
    },
    {
      path: "/catalogs/event-types/list",
      name: "List Event Types",
      component: <EventTypesList />,
      isPublic: false,
    },

    // locations
    {
      path: "/catalogs/locations/edit/:uuid",
      name: "Edit Location",
      component: <EditLocation />,
      isPublic: false,
    },
    {
      path: "/catalogs/locations/create",
      name: "Create Location",
      component: <CreateLocation />,
      isPublic: false,
    },
    {
      path: "/catalogs/locations/list",
      name: "List Locations",
      component: <LocationsList />,
      isPublic: false,
    },
    // request types
    {
      path: "/catalogs/request-types/edit/:uuid",
      name: "Edit Request Type",
      component: <EditRequestType />,
      isPublic: false,
    },
    {
      path: "/catalogs/request-types/create",
      name: "Create Request Type",
      component: <CreateRequestType />,
      isPublic: false,
    },
    {
      path: "/catalogs/request-types/list",
      name: "List Request Types",
      component: <RequestTypesList />,
      isPublic: false,
    },

    // distributors
    {
      path: "/catalogs/distributors/edit/:uuid",
      name: "Edit Distributor",
      component: <EditDistributor />,
      isPublic: false,
    },
    {
      path: "/catalogs/distributors/create",
      name: "Create Distributor",
      component: <CreateDistributor />,
      isPublic: false,
    },
    {
      path: "/catalogs/distributors/list",
      name: "List Distributors",
      component: <DistributorsList />,
      isPublic: false,
    },

    // retailers
    {
      path: "/catalogs/retailers/edit/:uuid",
      name: "Edit Retailer",
      component: <EditRetailer />,
      isPublic: false,
    },
    {
      path: "/catalogs/retailers/create",
      name: "Create Retailer",
      component: <CreateRetailer />,
      isPublic: false,
    },
    {
      path: "/catalogs/retailers/list",
      name: "List Retailers",
      component: <RetailersList />,
      isPublic: false,
    },
  ],
};

const CatalogsRoutes = [
  // Flattened leaf routes for router consumption
  ...CatalogsLinks.menu.flatMap((group) => group.links ?? []),
  ...CatalogsLinks.routes,
];

/* -----------------------------------------------------------
    CALENDAR
----------------------------------------------------------- */
const CalendarLinks = {
  menu: [
    {
      path: "/connect-calendar",
      name: "Calendar",
      component: <SparkCalendar />,
      Icon: CalendarIcon,
    },
  ],
  routes: [
    // Spark v2: /connect-calendar shows the wireframe Shifts Board.
    // The Google Calendar integration UI moves to /settings/calendar
    // (sidebar Settings group).
    {
      path: "/connect-calendar",
      component: <SparkCalendar />,
      isPublic: false,
    },
    {
      path: "/settings/calendar",
      component: <CalendarConnection />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
  SETTINGS
----------------------------------------------------------- */
const SettingsLinks = {
  menu: [
    {
      path: "/settings",
      name: "Workspace",
      component: <SparkSettings />,
      Icon: Palette,
    },
    {
      path: "/customize-theme",
      name: "Customize Theme",
      component: <ThemePage />,
      Icon: Palette,
    },
  ],
  routes: [
    {
      path: "/settings",
      component: (
        <AdminOnly>
          <SparkSettings />
        </AdminOnly>
      ),
      isPublic: false,
    },
    {
      path: "/customize-theme",
      component: <ThemePage />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
  GOALS
----------------------------------------------------------- */
const GoalsLinks = {
  menu: [
    {
      path: "/goals/list",
      name: "List",
      component: <GoalsList />,
      Icon: Bars4Icon,
    },
    {
      path: "/goals/create",
      name: "Create",
      component: <CreateGoals />,
      Icon: PlusCircleIcon,
    },
  ],
  routes: [
    {
      path: "/goals/list",
      component: <GoalsList />,
      isPublic: false,
    },
    {
      path: "/goals/create",
      component: <CreateGoals />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
  ACTIVATION PLANS
----------------------------------------------------------- */
const PlansLinks = {
  routes: [
    {
      path: "/plans",
      component: <PlansList />,
      isPublic: false,
    },
    {
      path: "/plans/:uuid",
      component: <PlanDetail />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   EXPORT: SIDEBAR MENU
----------------------------------------------------------- */
export const navigationMenuRoutes = [
  {
    path: "/",
    title: "Dashboards",
    Icon: ChartPieIcon,
    links: DashboardLinks.menu,
  },
  {
    title: "Requests",
    Icon: ClipboardDocumentListIcon,
    links: RequestsLinks.menu,
  },
  {
    title: "Events",
    Icon: CalendarDaysIcon,
    links: EventsLinks.menu,
  },
  {
    title: "Users",
    Icon: UserGroupIcon,
    links: UsersLinks.menu,
  },
  {
    title: "Recaps",
    Icon: CameraIcon,
    links: RecapLinks.menu,
  },
  {
    title: "Product",
    Icon: BuildingStorefrontIcon,
    links: ProductLinks.menu,
  },
  {
    title: "Catalogs",
    Icon: TagIcon,
    links: CatalogsLinks.menu,
  },
  {
    title: "Connect Calendar",
    path: "/connect-calendar", // Solo link, no submenu
    Icon: CalendarIcon,
  },
  {
    title: "Settings",
    Icon: AdjustmentsHorizontalIcon,
    links: SettingsLinks.menu,
  },
  {
    title: "Goals",
    Icon: FlagIcon,
    links: GoalsLinks.menu,
  },
];

/* -----------------------------------------------------------
   EXPORT: APP ROUTES (SOLO ROUTES REALES)
----------------------------------------------------------- */
export const appRoutes = [
  ...DashboardLinks.routes,
  ...RequestsLinks.routes,
  ...EventsLinks.routes,
  ...UsersLinks.routes,
  ...RecapLinks.routes,
  ...ProductLinks.routes,
  ...CatalogsRoutes,
  //Calendar
  ...CalendarLinks.routes,
  ...PublicRoutes.routes,
  ...SettingsLinks.routes,
  ...GoalsLinks.routes,
  ...PlansLinks.routes,
];
