import React, { Suspense, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import TenantPicker from "./TenantPicker";
import { ChevronDown, ChevronRight } from "lucide-react";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import {
  LayoutDashboard,
  ListChecks,
  Calendar,
  MapPin,
  CheckCircle2,
  Hammer,
  Users,
  Star,
  FileText,
  BarChart3,
  Mail,
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
  ScrollText,
  Wrench,
  Plus,
  GraduationCap,
} from "lucide-react";

/**
 * Spark v2 sidebar — uses the verbatim .nav-item / .nav-section / .nav-badge
 * classes lifted from spark-demo/index.html so React renders the same pixels.
 */

type ChipTone = "lime" | "orange" | "sky" | "purple" | "gold";

type NavItem = {
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  to?: string;
  chip?: { text: string; tone: ChipTone; blink?: boolean };
  stub?: boolean;
  adminOnly?: boolean;
  // Optional alternate label for the client view.
  clientLabel?: string;
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
    title: "Workspace",
    items: [
      { label: "Dashboard", Icon: LayoutDashboard, to: "/" },
      { label: "Today", Icon: Radio, to: "/today" },
      { label: "Upcoming", Icon: CalendarRange, to: "/upcoming" },
      {
        label: "Recent submissions",
        Icon: Inbox,
        to: "/recent",
        adminOnly: true,
      },
      {
        label: "Master Tracker",
        Icon: ListChecks,
        to: "/requests/list",
        clientLabel: "My Requests",
      },
      {
        label: "Recaps",
        Icon: FileText,
        to: "/recaps/list",
        clientLabel: "My Recaps",
      },
      {
        label: "Missing Recaps",
        Icon: FileText,
        to: "/recaps/missing",
        // Client tenants don't typically nudge BAs — this is an
        // ops/admin action. Hide on client surface.
        adminOnly: true,
      },
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
        adminOnly: true,
      },
      {
        label: "Approvals",
        Icon: CheckCircle2,
        to: "/approvals",
        adminOnly: true,
      },
      {
        label: "Audit log",
        Icon: ScrollText,
        to: "/audit",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Talent",
    adminOnly: true,
    items: [
      { label: "Jobs", Icon: Hammer, to: "/jobs" },
      { label: "Search Talent", Icon: Users, to: "/talent" },
      { label: "Favorites", Icon: Star, to: "/favorites" },
      { label: "People", Icon: UsersRound, to: "/people" },
      { label: "Spark Academy", Icon: GraduationCap, to: "/academy" },
      { label: "Manage Library", Icon: GraduationCap, to: "/academy/manage" },
    ],
  },
  {
    title: "Outputs",
    items: [
      { label: "Reports", Icon: BarChart3, to: "/reports" },
    ],
  },
  {
    title: "Communication",
    items: [
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
      { label: "Clients", Icon: Building2, to: "/clients" },
      { label: "Team", Icon: UsersRound, to: "/team" },
      { label: "New Client", Icon: Plus, to: "/clients/new" },
    ],
  },
  {
    title: "System",
    adminOnly: true,
    items: [
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

const chipClass = (tone: ChipTone): string => {
  switch (tone) {
    case "orange":
      return "chip chip-orange";
    case "sky":
      return "chip chip-sky";
    case "purple":
      return "chip chip-purple";
    case "gold":
      return "chip chip-gold";
    default:
      return "chip chip-lime";
  }
};

const CollapsibleNavSection: React.FC<{
  section: NavSection;
  pathname: string;
  defaultOpen: boolean;
  onStub: (label: string) => void;
  isClient?: boolean;
}> = ({ section, pathname, defaultOpen, onStub, isClient }) => {
  const [open, setOpen] = useState(defaultOpen);
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
  const active = isActive(item.to, pathname);
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
      <span className="truncate">{label}</span>
      {item.chip && (
        <span
          className={`${chipClass(item.chip.tone)} nav-badge ${item.chip.blink ? "spark-blink" : ""}`}
        >
          {item.chip.text}
        </span>
      )}
    </>
  );
  if (item.stub || !item.to) {
    return (
      <button onClick={() => onStub(item.label)} className={cls}>
        {content}
      </button>
    );
  }
  return (
    <Link to={item.to} className={cls}>
      {content}
    </Link>
  );
};

const onStub = (label: string) => {
  const id = "spark-stub-toast";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.className =
    "fixed bottom-6 left-6 z-50 rounded-md px-4 py-3 shadow-lg max-w-xs";
  el.style.cssText =
    "background: var(--spark-surface); border:1px solid var(--spark-border);";
  el.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.16em;color:var(--spark-lime);margin-bottom:0.25rem;">COMING SOON</p><p style="font-size:0.875rem;color:var(--spark-text);">${label} ships in a later phase.</p>`;
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
  const withChips: NavSection[] = sections.map((s) => ({
    ...s,
    items: s.items.map((it) => {
      let chip: NavItem["chip"];
      if (it.to === "/requests/list" && counts.tracker > 0) {
        // Recap-due takes priority over the active-tracker count so
        // ops sees "12 RECAPS DUE" (orange) before the calmer total.
        // Falls back to the active count when no recaps are
        // outstanding.
        if (counts.recapsDue > 0) {
          chip = {
            text: `${counts.recapsDue} RECAP${counts.recapsDue === 1 ? "" : "S"} DUE`,
            tone: "orange",
            blink: counts.recapsDue > 5,
          };
        } else {
          chip = { text: String(counts.tracker), tone: "lime" };
        }
      }
      if (it.to === "/approvals" && counts.approvals > 0)
        chip = {
          // Pulse orange when there's at least one SLA-breached pending
          // request (>72h). Without a breach we use the calmer gold tone
          // so the sidebar doesn't scream just because requests exist.
          text: String(counts.approvals),
          tone: counts.approvalsSlaBreach > 0 ? "orange" : "gold",
          blink: counts.approvalsSlaBreach > 0,
        };
      if (it.to === "/recaps/list" && counts.done30d > 0)
        chip = { text: String(counts.done30d), tone: "lime" };
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
              isClient || section.title === "Workspace" || activeInSection
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
  const { user, tenantMeta } = useAuthStore();
  const { pathname } = useLocation();
  const { isClient } = useSparkRole();
  // Filter sections + items by role.
  const visibleSections: NavSection[] = SECTIONS.filter(
    (s) => !s.adminOnly || !isClient,
  ).map((s) => ({
    ...s,
    items: s.items.filter((it) => !it.adminOnly || !isClient),
  }));
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();
  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-screen min-h-0"
      style={{
        background: "rgba(10,13,9,0.85)",
        borderRight: "1px solid var(--spark-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Brand mark — real Spark logo PNG, inverted to white for the
          dark sidebar (the source logo is black on transparent). */}
      <div
        className="px-5 py-5"
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
      </div>

      {/* Tenant picker */}
      <div
        className="px-3 py-3"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <div className="label-mini mb-1.5 px-1">Tenant</div>
        <Suspense
          fallback={
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <span
                className="w-5 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(197,245,70,0.15)",
                  color: "var(--spark-lime)",
                }}
              >
                {tenantDisplay.slice(0, 2).toUpperCase()}
              </span>
              <span
                className="text-sm truncate flex-1"
                style={{ color: "rgba(255,255,255,0.55)" }}
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
      <Suspense
        fallback={
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
                    isClient ||
                    section.title === "Workspace" ||
                    activeInSection
                  }
                  onStub={onStub}
                  isClient={isClient}
                />
              );
            })}
          </nav>
        }
      >
        <SidebarNav
          sections={visibleSections}
          pathname={pathname}
          isClient={isClient}
          onStub={onStub}
        />
      </Suspense>

      {/* Footer */}
      <div
        className="px-3 py-3 flex items-center gap-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <span className="spark-avatar">{initial}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {user?.firstName ?? user?.email ?? "User"}
          </p>
          <p
            className="mono text-[10px] truncate"
            style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.4)" }}
          >
            {isClient ? "CLIENT VIEW" : "IGNITE PRODUCTIONS"}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default SparkSidebar;
