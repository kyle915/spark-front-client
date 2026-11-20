import React, { Suspense, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { isTorchTenant } from "@/field/torch";
import useSparkRole from "@/hooks/useSparkRole";
import TenantPicker from "./TenantPicker";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import ErrorBoundary from "@/components/ErrorBoundary";
import useChatUnreadCount from "@/hooks/useChatUnreadCount";
import { useMobileNav } from "./MobileNavContext";
import {
  Activity,
  LayoutDashboard,
  ListChecks,
  Calendar,
  MapPin,
  CheckCircle2,
  Hammer,
  Users,
  Star,
  FileText,
  Images,
  BarChart3,
  Mail,
  MessageCircle,
  Megaphone,
  Bell,
  Clock,
  CreditCard,
  DollarSign,
  Upload,
  Building2,
  UsersRound,
  Settings,
  CalendarClock,
  HelpCircle,
  Radio,
  CalendarRange,
  Inbox,
  Wrench,
  Plus,
  GraduationCap,
  Receipt,
  ShieldCheck,
  Package,
  Store,
  Truck,
  Tags,
  ClipboardList,
  Route,
  QrCode,
  LayoutGrid,
  MailCheck,
  Plug,
} from "lucide-react";

/**
 * Spark v2 sidebar — uses the verbatim .nav-item / .nav-section / .nav-badge
 * classes lifted from spark-demo/index.html so React renders the same pixels.
 */

type ChipTone = "lime" | "orange" | "sky" | "purple" | "gold" | "muted";

type NavItem = {
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  to?: string;
  chip?: { text: string; tone: ChipTone; /** Spoken form, when the number alone is not enough. */ label?: string };
  stub?: boolean;
  adminOnly?: boolean;
  // Optional alternate label for the client view.
  clientLabel?: string;
  // Optional alternate route for the client view — used so the
  // Dashboard item points at /client-dashboard for client users
  // while admins continue to land on the full /dashboard.
  clientTo?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
  clientTitle?: string;
};

// Stub items removed entirely (Apple pattern: don't show what doesn't exist).
// Chip badges stripped for now until live counts are wired — fake numbers
// erode trust faster than missing decoration.
// `adminOnly` items + sections are hidden from client view. Client view
// surfaces only what brand stakeholders need: their requests, their
// recaps, reports, and the inbox to message Ignite.
const SECTIONS: NavSection[] = [
  {
    title: "Today",
    items: [
      {
        label: "Dashboard",
        Icon: LayoutDashboard,
        to: "/",
        clientTo: "/client-dashboard",
      },
      { label: "Today", Icon: Radio, to: "/today" },
      { label: "Upcoming", Icon: CalendarRange, to: "/upcoming" },
      {
        label: "On the Clock",
        Icon: Clock,
        to: "/live-board",
        adminOnly: true,
      },
      {
        label: "Staffing Board",
        Icon: LayoutGrid,
        to: "/schedule",
        adminOnly: true,
      },
      {
        label: "Event Confirmation",
        Icon: MailCheck,
        to: "/event-confirmation",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Recaps",
    items: [
      {
        label: "Recaps",
        Icon: FileText,
        to: "/recaps/list",
        clientLabel: "My Recaps",
      },
      { label: "Photos", Icon: Images, to: "/photos" },
      {
        label: "Missing Recaps",
        Icon: FileText,
        to: "/recaps/missing",
        adminOnly: true,
      },
      {
        label: "Receipts",
        Icon: Receipt,
        to: "/receipts",
        adminOnly: true,
      },
      {
        label: "Receipt checks",
        Icon: ShieldCheck,
        to: "/receipt-checks",
        adminOnly: true,
      },
      {
        label: "Master Tracker",
        Icon: ListChecks,
        to: "/requests/list",
        // Matches the page title brand users see ("My requests.").
        clientLabel: "My Requests",
      },
      {
        label: "All Plans",
        Icon: CalendarRange,
        to: "/plans",
        clientLabel: "Plans",
      },
      {
        label: "Approvals",
        Icon: CheckCircle2,
        to: "/approvals",
        clientTo: "/my-approvals",
        clientLabel: "Approvals",
      },
      {
        label: "Walk-ups",
        Icon: QrCode,
        to: "/walkups",
        adminOnly: true,
      },
      {
        label: "People",
        Icon: UsersRound,
        to: "/people",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        label: "Timesheet",
        Icon: Receipt,
        to: "/timesheet",
        adminOnly: true,
      },
      {
        label: "Campaign Cost",
        Icon: DollarSign,
        to: "/campaign-cost",
        adminOnly: true,
      },
      { label: "Jobs", Icon: Hammer, to: "/jobs", adminOnly: true },
      {
        label: "Recent submissions",
        Icon: Inbox,
        to: "/recent",
        clientLabel: "Recent Submissions",
      },
      { label: "Chat", Icon: MessageCircle, to: "/chat", adminOnly: true },
      {
        label: "Bulk Upload",
        Icon: Upload,
        to: "/requests/bulk-upload",
        clientLabel: "Bulk Upload",
      },
      { label: "Calendar", Icon: Calendar, to: "/connect-calendar" },
      {
        label: "Account Map",
        Icon: MapPin,
        to: "/account-map",
        clientLabel: "Account Map",
      },
      { label: "AI connector", Icon: Plug, to: "/ai-connector" },
    ],
  },
  {
    title: "Talent",
    adminOnly: true,
    items: [
      { label: "Search Talent", Icon: Users, to: "/talent" },
      { label: "Favorites", Icon: Star, to: "/favorites" },
      { label: "Spark Academy", Icon: GraduationCap, to: "/academy" },
      { label: "Manage Library", Icon: GraduationCap, to: "/academy/manage" },
    ],
  },
  {
    title: "Outputs",
    items: [
      { label: "Reports", Icon: BarChart3, to: "/reports" },
      // Ignite-internal: each brand's written weekly summary and monthly
      // email draft, for staff to review and copy. Nothing is sent from it.
      { label: "Client summaries", Icon: FileText, to: "/weekly-summaries", adminOnly: true },
      // Ignite-internal cost lens — labor + spend per event.
      { label: "P&L", Icon: DollarSign, to: "/pnl", adminOnly: true },
      // Consolidated samples/hour + SKU + locations + upcoming + call-outs
      // rollup for guerrilla field-sampling programs (Feel Free). Client-
      // visible: tenantFieldSamplingReport/generateFieldSamplingCalloutSummary
      // both resolve the tenant server-side for non-admins (same
      // resolve_target_tenant_id every other tenant chart in this file
      // uses), so a client can only ever see their own tenant's data.
      {
        label: "Field Sampling Report",
        Icon: Route,
        to: "/field-sampling-report",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      // Chat moved to the WORKSPACE group above (keeps its /chat route,
      // unread badge, and MessageCircle icon).
      // Admin-only: the page itself is an Ignite broadcast tool and shows
      // "Admin only." to brand users, so don't offer it in their nav.
      { label: "Announcements", Icon: Megaphone, to: "/announcements", adminOnly: true },
      { label: "Inbox", Icon: Mail, to: "/inbox" },
      { label: "Alerts", Icon: Bell, to: "/alerts" },
    ],
  },
  {
    title: "Operations",
    adminOnly: true,
    items: [
      { label: "Payroll · Hours", Icon: Clock, to: "/payroll" },
      { label: "Payments · Wingspan", Icon: CreditCard, to: "/payments" },
    ],
  },
  {
    title: "Build",
    adminOnly: true,
    items: [
      { label: "Form Builder", Icon: Wrench, to: "/forms/builder" },
      { label: "Recap Templates", Icon: Star, to: "/recaps/templates" },
      { label: "Products", Icon: Package, to: "/products/products-list" },
      { label: "Clients", Icon: Building2, to: "/clients" },
      { label: "Team", Icon: UsersRound, to: "/team" },
      { label: "New Client", Icon: Plus, to: "/clients/new" },
    ],
  },
  {
    // The /catalogs/* admin pages (towns, retailers, distributors, and the
    // type lists) exist + are routed but lost their nav links in the v2
    // sidebar — so "where do I add a new town?" had no answer. Each links to
    // the list page, which has the + Create button.
    title: "Catalogs",
    adminOnly: true,
    items: [
      { label: "Locations (Towns)", Icon: MapPin, to: "/catalogs/locations/list" },
      { label: "Retailers", Icon: Store, to: "/catalogs/retailers/list" },
      // One store typed several ways, combined for reports. Staff only.
      { label: "Store names", Icon: ListChecks, to: "/catalogs/store-names" },
      { label: "Distributors", Icon: Truck, to: "/catalogs/distributors/list" },
      { label: "Event Types", Icon: CalendarRange, to: "/catalogs/event-types/list" },
      { label: "Product Types", Icon: Tags, to: "/catalogs/product-types/list" },
      { label: "Request Types", Icon: ClipboardList, to: "/catalogs/request-types/list" },
    ],
  },
  {
    title: "System",
    adminOnly: true,
    items: [
      { label: "System Health", Icon: Activity, to: "/system-health" },
      { label: "Settings", Icon: Settings, to: "/settings" },
      { label: "Calendar Sync", Icon: CalendarClock, to: "/settings/calendar" },
      { label: "Billing", Icon: DollarSign, to: "/billing" },
      { label: "Help", Icon: HelpCircle, to: "/help" },
    ],
  },
];

// Icons referenced for future expansion / future Billing page — kept
// imported so the linter doesn't strip them before we wire those entries.
void DollarSign;
void Clock;
void CreditCard;
void Building2;
void HelpCircle;

const slugToName = (slug: string | null | undefined): string => {
  if (!slug) return "—";
  const parts = slug.split("-").filter(Boolean);
  const drop = new Set(["ighn", "ig", "ign"]);
  const brand =
    parts.length > 1 && drop.has(parts[0].toLowerCase())
      ? parts.slice(1)
      : parts;
  return brand
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
};

const isActive = (path: string | undefined, pathname: string) => {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

// Sidebar counts are solid pills, in the manner of an app-icon badge: one
// strong colour for "needs someone", a quiet fill for a plain count. They do
// not blink; a filled mark is already the loudest thing in the column.
const badgeClass = (tone: ChipTone): string => {
  switch (tone) {
    case "orange":
    case "gold":
      return "nav-badge--alert";
    case "muted":
    case "sky":
    case "purple":
      return "nav-badge--count";
    default:
      return "nav-badge--new";
  }
};

const CollapsibleNavSection: React.FC<{
  section: NavSection;
  pathname: string;
  defaultOpen: boolean;
  onStub: (label: string) => void;
  isClient?: boolean;
}> = ({ section, pathname, defaultOpen, onStub, isClient }) => {
  // Remember each section's open/closed state across reloads. The section
  // holding the current page still opens by default the first time.
  const storageKey = `@spark.nav.open.${section.title}`;
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "1") return true;
      if (saved === "0") return false;
    } catch {
      /* storage unavailable — fall through */
    }
    return defaultOpen;
  });
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    setOpenState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try {
        window.localStorage.setItem(storageKey, value ? "1" : "0");
      } catch {
        /* ignore */
      }
      return value;
    });
  };
  const title =
    isClient && section.clientTitle ? section.clientTitle : section.title;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="nav-section w-full flex items-center justify-between transition"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div className="space-y-0.5 px-1">
          {section.items.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              pathname={pathname}
              onStub={onStub}
              isClient={isClient}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NavRow: React.FC<{
  item: NavItem;
  pathname: string;
  onStub: (label: string) => void;
  isClient?: boolean;
}> = ({ item, pathname, onStub, isClient }) => {
  const effectiveTo =
    isClient && item.clientTo ? item.clientTo : item.to;
  const active = isActive(effectiveTo, pathname);
  const cls = `nav-item ${active ? "active" : ""}`;
  const Icon = item.Icon;
  const label = isClient && item.clientLabel ? item.clientLabel : item.label;
  const content = (
    <>
      <span
        className="shrink-0 flex items-center justify-center"
        style={{ width: 22, opacity: 0.85 }}
        aria-hidden
      >
        <Icon size={16} />
      </span>
      <span className="truncate spark-sidebar-label">{label}</span>
      {item.chip && (
        <span
          className={`nav-badge ${badgeClass(item.chip.tone)}`}
          aria-label={item.chip.label}
        >
          {item.chip.text}
        </span>
      )}
    </>
  );
  if (item.stub || !effectiveTo) {
    return (
      <button
        onClick={() => onStub(item.label)}
        className={cls}
        title={label}
        aria-label={label}
      >
        {content}
      </button>
    );
  }
  return (
    <Link to={effectiveTo} className={cls} title={label} aria-label={label}>
      {content}
    </Link>
  );
};

const onStub = (label: string) => {
  const id = "spark-stub-toast";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.className = "spark-toast fixed bottom-6 left-6 z-50 px-4 py-3 max-w-xs";
  el.style.cssText = "border-color: var(--spark-border);";
  const kicker = document.createElement("p");
  kicker.style.cssText =
    "font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.16em;color:var(--spark-lime);margin-bottom:0.25rem;";
  kicker.textContent = "COMING SOON";
  const body = document.createElement("p");
  body.style.cssText = "font-size:0.875rem;color:var(--spark-text);";
  body.textContent = `${label} ships in a later phase.`;
  el.append(kicker, body);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
};

// Inner component reads the counts query (suspending), then applies them
// to nav items as chip badges before rendering the nav. Keeps the
// Suspense boundary clean.
const SidebarNav: React.FC<{
  sections: NavSection[];
  pathname: string;
  isClient: boolean;
  onStub: (label: string) => void;
}> = ({ sections, pathname, isClient, onStub }) => {
  const counts = useSidebarCounts();
  // Chat unread is on its own polled hook (60s) so it can refresh
  // without re-pulling the heavy RequestsQuery that useSidebarCounts
  // owns. Lime tone matches the mobile badge.
  const chatUnread = useChatUnreadCount();
  const withChips: NavSection[] = sections.map((s) => ({
    ...s,
    items: s.items.map((it) => {
      let chip: NavItem["chip"];
      if (it.to === "/chat" && chatUnread > 0) {
        chip = {
          text: chatUnread > 99 ? "99+" : String(chatUnread),
          tone: "lime",
        };
      }
      if (it.to === "/requests/list" && counts.tracker > 0) {
        // Inventory count — outline, not the lime Create Request alarm.
        chip = { text: String(counts.tracker), tone: "muted" };
      }
      if (it.to === "/approvals" && counts.approvals > 0)
        chip = {
          // Pulse orange when there's at least one SLA-breached pending
          // request (>72h). Without a breach we use the calmer gold tone
          // so the sidebar doesn't scream just because requests exist.
          text: String(counts.approvals),
          tone: counts.approvalsSlaBreach > 0 ? "orange" : "gold",
        };
      if (it.to === "/recaps/list" && !isClient && counts.recapsNeedsReview > 0)
        chip = {
          text: String(counts.recapsNeedsReview),
          tone: "gold",
        };
      if (it.to === "/recaps/missing" && counts.recapsDue > 0)
        chip = {
          text: String(counts.recapsDue),
          label: `${counts.recapsDue} recaps due`,
          tone: "orange",
        };
      if (it.to === "/walkups" && counts.pendingWalkups > 0)
        chip = {
          // Walk-ups awaiting confirmation — gold (a review queue, not an
          // alarm); pulse only when the pile grows past a handful.
          text: String(counts.pendingWalkups),
          tone: "gold",
        };
      if (it.to === "/alerts" && counts.alertsUnread > 0)
        chip = { text: String(counts.alertsUnread), tone: "orange" };
      return chip ? { ...it, chip } : it;
    }),
  }));

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2 hide-scroll">
      {withChips.map((section) => {
        const activeInSection = section.items.some(
          (it) => it.to && isActive(it.to, pathname),
        );
        return (
          <CollapsibleNavSection
            key={section.title}
            section={section}
            pathname={pathname}
            defaultOpen={
              section.title === "Catalogs" ||
              section.title === "Build" ||
              section.title === "System"
                ? activeInSection
                : isClient ||
                  section.title === "Today" ||
                  section.title === "Recaps" ||
                  activeInSection
            }
            onStub={onStub}
            isClient={isClient}
          />
        );
      })}
    </nav>
  );
};

export const SparkSidebar: React.FC = () => {
  const { user, tenantMeta, tenantSlug } = useAuthStore();
  const { pathname } = useLocation();
  const { isClient } = useSparkRole();
  const { open, setOpen } = useMobileNav();
  // Filter sections + items by role.
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const missingRecapsOn = showsMissingRecaps(
    tenantSlug,
    tenantMeta?.requestUrlName,
  );
  const visibleSections: NavSection[] = SECTIONS.filter(
    (s) => !s.adminOnly || !isClient,
  ).map((s) => {
    let items = s.items.filter((it) => !it.adminOnly || !isClient);
    if (s.title !== "Recaps") return { ...s, items };
    if (!missingRecapsOn) {
      items = items.filter((it) => it.to !== "/recaps/missing");
    }
    if (!torch) return { ...s, items };
    // Torch: one Plans nav (field marketing). Hide Activation Plans.
    items = items.filter((it) => it.to !== "/plans");
    const trackerAt = items.findIndex((it) => it.to === "/requests/list");
    const plansItem: NavItem = {
      label: "Plans",
      Icon: CalendarRange,
      to: "/field-marketing",
      clientLabel: "Plans",
    };
    if (trackerAt < 0) return { ...s, items: [...items, plansItem] };
    const next = items.slice();
    next.splice(trackerAt + 1, 0, plansItem);
    return { ...s, items: next };
  });
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();
  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);

  // The nav rendered WITHOUT badge counts. Used both as the Suspense
  // fallback (while the counts query loads) AND as the ErrorBoundary
  // fallback below — so if the counts query ever throws, the nav stays
  // fully usable (just no badge numbers) instead of blanking the app.
  const navFallback = (
    <nav className="flex-1 overflow-y-auto px-2 py-2 hide-scroll">
      {visibleSections.map((section) => {
        const activeInSection = section.items.some(
          (it) => it.to && isActive(it.to, pathname),
        );
        return (
          <CollapsibleNavSection
            key={section.title}
            section={section}
            pathname={pathname}
            defaultOpen={
              section.title === "Catalogs" ||
              section.title === "Build" ||
              section.title === "System"
                ? activeInSection
                : isClient ||
                  section.title === "Today" ||
                  section.title === "Recaps" ||
                  activeInSection
            }
            onStub={onStub}
            isClient={isClient}
          />
        );
      })}
    </nav>
  );

  return (
    <aside
      className={[
        "spark-sidebar shrink-0 flex flex-col h-screen min-h-0 w-64",
        "fixed inset-y-0 left-0 z-50 transition-[width,transform] duration-200 ease-out md:sticky md:top-0 md:bottom-auto md:translate-x-0 md:z-auto",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      style={{
        background: "rgba(var(--spark-bg-rgb),0.92)",
        borderRight: "1px solid var(--spark-border)",
        backdropFilter: "blur(12px)",
      }}
      aria-label="Main navigation"
    >
      {/* Brand mark — real Spark logo PNG, inverted to white for the
          dark sidebar (the source logo is black on transparent). */}
      <div
        className="spark-sidebar-brand flex items-center gap-2 px-5 py-5 justify-between"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <img
          src="/legal/spark-logo.png"
          alt="Spark by Ignite"
          style={{
            height: 28,
            width: "auto",
            display: "block",
            filter: "invert(1) hue-rotate(180deg)",
          }}
        />
        <button
          type="button"
          className="md:hidden btn btn-ghost btn-sm btn-square"
          style={{ minWidth: "var(--spark-hit, 44px)", minHeight: "var(--spark-hit, 44px)" }}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tenant picker */}
      <div
        className="px-3 py-3 spark-sidebar-expand-only"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <div className="label-mini mb-1.5 px-1">Tenant</div>
        <Suspense
          fallback={
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md"
              style={{
                background: "rgba(var(--spark-ink-rgb),0.025)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <span
                className="w-5 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(var(--spark-accent-rgb),0.15)",
                  color: "var(--spark-lime)",
                }}
              >
                {tenantDisplay.slice(0, 2).toUpperCase()}
              </span>
              <span
                className="text-sm truncate flex-1"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {tenantDisplay}
              </span>
            </div>
          }
        >
          <TenantPicker />
        </Suspense>
      </div>

      {/* Nav — collapsed by default except Workspace and the section
          containing the active route. Counts on chip badges come from
          useSidebarCounts (suspends on first load). */}
      {/* ErrorBoundary OUTSIDE Suspense: if the counts query throws (not
          just suspends), fall back to the same count-less nav instead of
          letting the throw blank the whole app (the sidebar is chrome,
          above the page-content boundary in Layout). */}
      <ErrorBoundary fallback={navFallback}>
        <Suspense fallback={navFallback}>
          <SidebarNav
            sections={visibleSections}
            pathname={pathname}
            isClient={isClient}
            onStub={onStub}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Footer */}
      <div
        className="spark-sidebar-footer px-3 py-3 flex items-center gap-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <span className="spark-avatar">{initial}</span>
        <div className="flex-1 min-w-0 spark-sidebar-expand-only">
          <p className="text-sm font-semibold truncate">
            {user?.firstName ?? user?.email ?? "User"}
          </p>
          <p
            className="mono text-[10px] truncate"
            style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
          >
            {isClient ? "CLIENT VIEW" : "IGNITE PRODUCTIONS"}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default SparkSidebar;
