import React, { Suspense } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "@/store/authStore";
import TenantPicker from "./TenantPicker";

/**
 * Spark v2 sidebar — wireframe-faithful version of spark-demo/index.html
 * (lines 409–466).
 *
 * The IA in the wireframe is deliberately different from the legacy
 * navigationMenuRoutes (which had a 10-group / collapsible structure). The
 * wireframe groups items into six flat sections (Workspace / Talent / Outputs
 * / Communication / Operations / System) with chip badges per item. We map
 * each wireframe item to a real route in the existing app when one exists,
 * and mark the rest as `stub: true` so click opens a toast instead of 404.
 */

type ChipTone = "lime" | "orange" | "sky" | "purple" | "gold" | null;

type NavItem = {
  label: string;
  icon: string; // glyph from the wireframe — replaced with proper icons later
  to?: string;
  chip?: { text: string; tone: ChipTone; blink?: boolean };
  stub?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

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
        to: "/requests/edited",
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
        stub: true,
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
      { label: "Help", icon: "?", stub: true },
    ],
  },
];

/** Map a slug like "ighn-liquid-death" → "Liquid Death" for display. */
const slugToName = (slug: string | null | undefined): string => {
  if (!slug) return "—";
  const parts = slug.split("-").filter(Boolean);
  // Drop common agency prefix segments
  const dropPrefixes = new Set(["ighn", "ig", "ign"]);
  const brandParts =
    parts.length > 1 && dropPrefixes.has(parts[0].toLowerCase())
      ? parts.slice(1)
      : parts;
  return brandParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
};

const chipClass = (tone: ChipTone, blink: boolean | undefined) => {
  const base =
    "ml-auto mono text-[10px] tracking-[0.1em] px-1.5 py-0.5 rounded border";
  const toneClass =
    tone === "orange"
      ? "bg-warning/15 text-warning border-warning/30"
      : tone === "sky"
        ? "bg-info/15 text-info border-info/30"
        : tone === "purple"
          ? "bg-accent/15 text-accent border-accent/30"
          : tone === "gold"
            ? "bg-amber-400/15 text-amber-400 border-amber-400/30"
            : "bg-primary/15 text-primary border-primary/30";
  return `${base} ${toneClass} ${blink ? "animate-pulse" : ""}`;
};

const isActive = (path: string | undefined, pathname: string) => {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

const NavItemRow: React.FC<{
  item: NavItem;
  pathname: string;
  onStub: (label: string) => void;
}> = ({ item, pathname, onStub }) => {
  const active = isActive(item.to, pathname);

  const inner = (
    <>
      <span
        className={`mono text-[14px] w-5 text-center shrink-0 ${active ? "text-primary-content" : "text-base-content/55"}`}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {item.chip && (
        <span
          className={chipClass(
            active ? "lime" : item.chip.tone,
            item.chip.blink,
          )}
        >
          {item.chip.text}
        </span>
      )}
    </>
  );

  const className = [
    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition w-full",
    active
      ? "bg-primary text-primary-content font-semibold"
      : "text-base-content/80 hover:text-base-content hover:bg-base-300/40",
  ].join(" ");

  if (item.stub || !item.to) {
    return (
      <button onClick={() => onStub(item.label)} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link to={item.to} className={className}>
      {inner}
    </Link>
  );
};

export const SparkSidebar: React.FC = () => {
  const { user, tenantMeta } = useAuthStore();
  const { pathname } = useLocation();
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();
  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);

  const onStub = (label: string) => {
    // Lightweight inline toast — replaced by <Toast/> in Phase 1.4
    const id = "stub-toast";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.className =
      "fixed bottom-6 left-6 z-50 bg-base-100 border border-base-300 rounded-md px-4 py-3 shadow-lg max-w-xs";
    el.innerHTML = `<p class="mono text-[10px] tracking-[0.16em] text-primary mb-1">COMING SOON</p><p class="text-sm">${label} ships in a later phase.</p>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-base-300 bg-base-100/80 backdrop-blur-xl flex flex-col h-screen min-h-0">
      {/* Brand mark — italic display "Spark" + mono "BY IGNITE" */}
      <div className="px-5 py-4 border-b border-base-300">
        <div className="flex items-baseline gap-2">
          <span
            className="display italic text-3xl font-bold tracking-tight"
            style={{ fontStyle: "italic" }}
          >
            Spark
          </span>
          <span className="mono text-[10px] tracking-[0.22em] text-base-content/45">
            BY IGNITE
          </span>
        </div>
      </div>

      {/* Tenant picker */}
      <div className="px-3 py-3 border-b border-base-300">
        <div className="label-mini mb-1.5">Tenant</div>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300">
              <span className="w-5 h-5 rounded-sm bg-base-300" />
              <span className="text-sm truncate flex-1 text-base-content/55">
                {tenantDisplay}
              </span>
            </div>
          }
        >
          <TenantPicker />
        </Suspense>
      </div>

      {/* Nav — flat sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 hide-scroll space-y-3">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="label-mini px-3 mb-1.5">{section.title}</div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemRow
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
      <div className="px-3 py-3 border-t border-base-300 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {user?.firstName ?? user?.email ?? "User"}
          </p>
          <p className="mono text-[10px] text-base-content/40 truncate">
            IGNITE PRODUCTIONS
          </p>
        </div>
      </div>
    </aside>
  );
};

export default SparkSidebar;
