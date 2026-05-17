import React, { Suspense } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "@/store/authStore";
import TenantPicker from "./TenantPicker";

/**
 * Spark v2 sidebar — uses the verbatim .nav-item / .nav-section / .nav-badge
 * classes lifted from spark-demo/index.html so React renders the same pixels.
 */

type ChipTone = "lime" | "orange" | "sky" | "purple" | "gold";

type NavItem = {
  label: string;
  icon: string;
  to?: string;
  chip?: { text: string; tone: ChipTone; blink?: boolean };
  stub?: boolean;
};

type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", icon: "◐", to: "/" },
      {
        label: "Master Tracker",
        icon: "▤",
        to: "/requests/list",
        chip: { text: "42", tone: "lime" },
      },
      { label: "Calendar", icon: "📅", to: "/connect-calendar" },
      {
        label: "Account Map",
        icon: "⌖",
        stub: true,
        chip: { text: "22", tone: "lime" },
      },
      {
        label: "Approvals",
        icon: "✓",
        to: "/approvals",
        chip: { text: "5", tone: "orange", blink: true },
      },
    ],
  },
  {
    title: "Talent",
    items: [
      {
        label: "Jobs",
        icon: "⚒",
        to: "/jobs",
        chip: { text: "14", tone: "orange" },
      },
      { label: "Search Talent", icon: "◍", stub: true },
      { label: "Favorites", icon: "★", stub: true },
    ],
  },
  {
    title: "Outputs",
    items: [
      { label: "Recaps", icon: "◈", to: "/recaps/list" },
      { label: "Reports", icon: "📈", stub: true },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        label: "Inbox",
        icon: "✉",
        stub: true,
        chip: { text: "23", tone: "lime" },
      },
      {
        label: "Alerts",
        icon: "🔔",
        stub: true,
        chip: { text: "12", tone: "lime" },
      },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Payroll · Hours", icon: "⏱", stub: true },
      {
        label: "Payments",
        icon: "🪶",
        stub: true,
        chip: { text: "$8.4k", tone: "lime" },
      },
      { label: "Billing", icon: "$", stub: true },
      {
        label: "Bulk Upload",
        icon: "⤴",
        stub: true,
        chip: { text: "FAST", tone: "lime" },
      },
      { label: "Clients", icon: "◐", stub: true },
      { label: "Team", icon: "👥", stub: true },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", icon: "⚙", to: "/settings" },
      { label: "Calendar Integration", icon: "📅", to: "/settings/calendar" },
      { label: "Help", icon: "?", stub: true },
    ],
  },
];

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

const NavRow: React.FC<{
  item: NavItem;
  pathname: string;
  onStub: (label: string) => void;
}> = ({ item, pathname, onStub }) => {
  const active = isActive(item.to, pathname);
  const cls = `nav-item ${active ? "active" : ""}`;
  const content = (
    <>
      <span className="nav-icon" aria-hidden>
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
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

export const SparkSidebar: React.FC = () => {
  const { user, tenantMeta } = useAuthStore();
  const { pathname } = useLocation();
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
      {/* Brand mark */}
      <div
        className="px-5 py-5"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <div className="spark-mark text-2xl">
          <span className="word">Spark</span>
          <span className="tag">BY IGNITE</span>
        </div>
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 hide-scroll">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
            <div className="space-y-0.5 px-1">
              {section.items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  onStub={onStub}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

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
            IGNITE PRODUCTIONS
          </p>
        </div>
      </div>
    </aside>
  );
};

export default SparkSidebar;
