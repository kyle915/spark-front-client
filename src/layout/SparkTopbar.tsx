import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import {
  crumbHidesRepeatedParent,
  documentTitleFor,
  humanizeSegment,
  routeTitleFor,
} from "./routeTitles";
import { createPortal } from "react-dom";
import SparkOverlay from "@/shared/SparkOverlay";
import {
  SHORTCUTS,
  whatsNewFor,
  feedbackMailto,
  hasUnseenWhatsNew,
  markWhatsNewSeen,
} from "./whatsNew";
import { useLocation, useNavigate } from "react-router";
import { LogOut, Menu, Search } from "lucide-react";
import { LeafTabs } from "@/motion/LeafTabs";
import { useAuthStore } from "@/store/authStore";
import NotificationBell from "./NotificationBell";
import useSparkRole from "@/hooks/useSparkRole";
import { looksLikeRouteId, usePageCrumb } from "./pageCrumb";
import { dispatchOpenJump } from "@/motion/opsMotion";
import { PublicFormPill, publicFormCtaLabel } from "./PublicFormPill";
import { usePublicFormLink } from "@/hooks/usePublicFormLink";
import { useMobileNav } from "./MobileNavContext";
import { TenantLogo } from "./TenantLogo.tsx";
import { setAppearance, useAppearance } from "@/theme/appearance";

/**
 * Spark v2 topbar — wireframe-faithful version of spark-demo/index.html
 * lines 467–490.
 *
 *   spark.app / DASHBOARD                         [Search ⌘K] [Admin|Client] avatar Logout
 */

type Role = "admin" | "client";

type CrumbParts = { parent: string; current: string };

const useBreadcrumb = (isClient: boolean): CrumbParts => {
  const { pathname } = useLocation();
  const pageCrumb = usePageCrumb();
  return useMemo(() => {
    if (pageCrumb) {
      return { parent: pageCrumb.parent, current: pageCrumb.title };
    }
    const known = routeTitleFor(pathname, { isClient });
    if (known) return { parent: known.parent, current: known.title };
    const parts = pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (looksLikeRouteId(last)) {
      const parent = parts[parts.length - 2] ?? "page";
      return {
        parent: humanizeSegment(parent),
        current: "Detail",
      };
    }
    const current = humanizeSegment(last);
    const parent =
      parts.length > 1 ? humanizeSegment(parts[parts.length - 2]) : "Spark";
    return { parent, current };
  }, [pathname, pageCrumb, isClient]);
};

function PublicFormPillSlot({ className = "" }: { className?: string }) {
  const publicForm = usePublicFormLink();
  return (
    <PublicFormPill
      slug={publicForm?.slug}
      url={publicForm?.url}
      kind={publicForm?.kind}
      className={className}
    />
  );
}

/**
 * Account-menu twin of the top-bar link pill, so the public request /
 * check-in link is one click away on screens too narrow for the pill.
 */
function PublicLinkMenuItem({ onDone }: { onDone: () => void }) {
  const publicForm = usePublicFormLink();
  const [copied, setCopied] = useState(false);
  if (!publicForm?.url) return null;
  const label = publicFormCtaLabel(publicForm.kind);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(publicForm.url ?? "");
          setCopied(true);
          window.setTimeout(onDone, 900);
        } catch {
          window.open(publicForm.url ?? "", "_blank", "noopener,noreferrer");
          onDone();
        }
      }}
      className="mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm"
      style={{ border: "1px solid var(--spark-border)" }}
    >
      <span>{copied ? "Link copied" : `Copy ${label.toLowerCase()}`}</span>
    </button>
  );
}

const ROLE_TAB_OPTIONS = [
  { key: "admin" as const, label: "Admin", title: "Ignite admin workspace view" },
  { key: "client" as const, label: "Client", title: "Preview brand client view" },
] as const;

export const SparkTopbar: React.FC = () => {
  const { user, tenantMeta, tenantSlug } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, isClient, setRole, canToggleRole } = useSparkRole();
  const crumb = useBreadcrumb(isClient);
  // Browser tab title follows the page, so several Spark tabs are tellable apart.
  useEffect(() => {
    const page =
      crumb.current === "Detail" ? `${crumb.parent} detail` : crumb.current;
    document.title = documentTitleFor(page);
  }, [crumb.current, crumb.parent]);
  const { toggle: toggleNav } = useMobileNav();
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    if (role === "client" && (pathname === "/" || pathname === "/dashboard")) {
      navigate("/client-dashboard", { replace: true });
    }
  }, [role, pathname, navigate]);

  // Account menu (avatar). On phones it also holds the Admin/Client
  // preview toggle and Logout so the bar stays on one row.
  const [menuOpen, setMenuOpen] = useState(false);
  const appearance = useAppearance();
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const clientName = tenantDisplayName(tenantMeta?.requestUrlName, tenantSlug);
  const [panel, setPanel] = useState<null | "whatsNew" | "shortcuts">(null);
  const [unseenNews, setUnseenNews] = useState(() => hasUnseenWhatsNew(isClient));
  // Staff vs client feeds can tip on different ids; recompute when Admin/Client toggles.
  useEffect(() => {
    setUnseenNews(hasUnseenWhatsNew(isClient));
  }, [isClient]);
  const openPanel = (which: "whatsNew" | "shortcuts") => {
    setMenuOpen(false);
    setPanel(which);
    if (which === "whatsNew") {
      markWhatsNewSeen(isClient);
      setUnseenNews(false);
    }
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const onRole = (next: Role) => {
    setRole(next);
    navigate(next === "client" ? "/client-dashboard" : "/");
  };

  const openJump = (el: HTMLElement) => {
    dispatchOpenJump(el);
  };

  return (
    <header
      className="sticky top-0 z-30 min-h-[48px] px-4 sm:px-6 py-1.5 flex items-center justify-between gap-2 sm:gap-3 flex-nowrap"
      style={{
        background: "color-mix(in srgb, var(--spark-bg) 92%, transparent)",
        borderBottom: "1px solid var(--spark-hairline, var(--spark-border))",
        WebkitBackdropFilter: "saturate(180%) blur(16px)",
        backdropFilter: "saturate(180%) blur(16px)",
      }}
    >
      {/* Left: menu + quiet breadcrumb + (optional) public share-link pill */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          className="md:hidden btn btn-ghost btn-sm btn-square shrink-0"
          style={{ minWidth: "var(--spark-hit, 44px)", minHeight: "var(--spark-hit, 44px)" }}
          aria-label="Open menu"
          onClick={toggleNav}
        >
          <Menu size={19} strokeWidth={1.85} />
        </button>
        {isClient ? (
          <TenantLogo
            variant="header"
            tone="dark"
            name={clientName || tenantMeta?.requestUrlName}
            requestUrlName={tenantMeta?.requestUrlName}
            tenantSlug={tenantSlug}
            image={tenantMeta?.logo}
          />
        ) : null}
        {/* On phones staff see the client chip instead of the crumb: the
            page title sits right below and the sidebar (which names the
            client on desktop) is closed. */}
        <div
          className={`min-w-0 ${isClient || clientName ? "hidden md:block" : ""}`}
        >
        <nav className="spark-crumb min-w-0" aria-label="Breadcrumb">
          {crumbHidesRepeatedParent(pathname, crumb.parent, crumb.current) ? null : (
            <>
              <span className="spark-crumb-root hidden sm:inline">
                {crumb.parent}
              </span>
              <span className="spark-crumb-sep hidden sm:inline" aria-hidden>
                /
              </span>
            </>
          )}
          <span
            className="spark-crumb-current truncate"
            style={{ maxWidth: "min(26vw, 280px)" }}
            title={crumb.current}
          >
            {crumb.current}
          </span>
        </nav>
        </div>

        {!isClient && clientName ? (
          <span
            className="inline-flex md:hidden items-center px-2.5 py-1 rounded-[6px] text-xs font-medium truncate max-w-[130px]"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
            title={`Working in ${clientName}. Switch workspaces from the sidebar.`}
          >
            {clientName}
          </span>
        ) : null}

        {/* Wide screens only: on a 13" laptop this pill pushed the bar onto
            two rows. */}
        <div className="hidden 2xl:block">
          <Suspense fallback={null}>
            <PublicFormPillSlot className="ml-2" />
          </Suspense>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate("/requests/create")}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition hover:opacity-90 active:scale-[0.99]"
          aria-label="Create Request"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
          title={
            isClient
              ? "Create a request in Spark for the current client tenant"
              : "Create a request in Spark"
          }
        >
          <span aria-hidden>+</span>
          <span className="hidden lg:inline">Create Request</span>
          <span className="lg:hidden">New</span>
        </button>

        <button
          type="button"
          data-spark-jump
          onClick={(e) => openJump(e.currentTarget)}
          className="spark-focus-ring flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-xs transition hover:opacity-100"
          style={{
            color: "var(--spark-text-secondary)",
            border: "1px solid var(--spark-border)",
            background: "var(--spark-surface)",
          }}
          aria-label="Jump to a page or recap"
        >
          <Search size={14} strokeWidth={1.85} />
          <span className="hidden sm:inline">Jump</span>
          <span
            className="hidden lg:inline ml-2 mono-code text-[10px] px-1.5 py-0.5 rounded-[5px]"
            style={{
              background: "var(--spark-surface-2)",
              color: "var(--spark-text-meta)",
              border: "1px solid var(--spark-hairline, var(--spark-border))",
            }}
          >
            ⌘K
          </span>
        </button>

        {canToggleRole ? (
          <div className="hidden xl:block">
            <LeafTabs
              ariaLabel="Workspace role view"
              value={role}
              onChange={(v) => onRole(v)}
              options={ROLE_TAB_OPTIONS}
            />
          </div>
        ) : null}

        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={unseenNews ? "Account menu, what's new" : "Account menu"}
            className="spark-focus-ring relative w-8 h-8 rounded-[8px] text-xs font-semibold flex items-center justify-center transition"
            style={{
              background: "var(--spark-surface-2)",
              color: "var(--spark-text)",
              boxShadow: "inset 0 0 0 1px var(--spark-border)",
            }}
          >
            {initial}
            {unseenNews ? (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                title="What's new"
                style={{
                  background: "var(--spark-orange)",
                  boxShadow: "0 0 0 2px var(--spark-bg)",
                }}
              />
            ) : null}
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 rounded-2xl p-3 z-40"
              style={{
                background: "var(--spark-surface, #0f1310)",
                border: "1px solid var(--spark-border)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
              }}
            >
              <p className="text-sm font-semibold truncate">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                  "Signed in"}
              </p>
              {user?.email ? (
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {user.email}
                </p>
              ) : null}
              {!isClient && clientName ? (
                <p
                  className="text-xs mt-2 truncate"
                  style={{ color: "var(--spark-text-secondary)" }}
                >
                  Client: {clientName}
                </p>
              ) : null}
              {canToggleRole ? (
                <div className="mt-3 xl:hidden">
                  <p
                    className="text-xs mb-1.5"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    View as
                  </p>
                  <LeafTabs
                    ariaLabel="Workspace role view"
                    value={role}
                    onChange={(v) => {
                      setMenuOpen(false);
                      onRole(v);
                    }}
                    options={ROLE_TAB_OPTIONS}
                  />
                </div>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => openPanel("whatsNew")}
                className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <span>What's new</span>
                {unseenNews ? (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--spark-sky)", color: "var(--spark-on-accent)" }}
                  >
                    New
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => openPanel("shortcuts")}
                className="mt-2 w-full flex items-center px-3 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                Keyboard shortcuts
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/email-preferences");
                }}
                className="mt-2 w-full flex items-center px-3 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                Email preferences
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAppearance(appearance === "light" ? "dark" : "light");
                }}
                className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <span>Appearance</span>
                <span style={{ color: "var(--spark-text-meta)" }}>
                  {appearance === "light" ? "Light" : "Dark"}
                </span>
              </button>
              <Suspense fallback={null}>
                <PublicLinkMenuItem onDone={() => setMenuOpen(false)} />
              </Suspense>
              <a
                role="menuitem"
                href={feedbackMailto({
                  pageTitle: crumb.current,
                  // Path only — query strings can carry filter values.
                  pageUrl: `${window.location.origin}${pathname}`,
                  clientName,
                })}
                onClick={() => setMenuOpen(false)}
                className="mt-2 w-full flex items-center px-3 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--spark-border)", textDecoration: "none", color: "inherit" }}
              >
                Send feedback
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:text-error"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <LogOut size={15} strokeWidth={1.85} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Portal: the header's backdrop blur would otherwise trap a fixed overlay. */}
      {createPortal(
      <SparkOverlay
        open={panel !== null}
        onClose={() => setPanel(null)}
        size="md"
        label={panel === "shortcuts" ? "Keyboard shortcuts" : "What's new"}
      >
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {panel === "whatsNew" ? (
            <>
              <h2 className="text-xl font-semibold">What's new in Spark</h2>
              {whatsNewFor(isClient).map((entry) => (
                <section key={entry.id} className="mt-4">
                  <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                    {entry.date}
                  </p>
                  <p className="text-base font-semibold mt-0.5">{entry.title}</p>
                  <ul className="mt-2 space-y-1.5 list-disc pl-5 text-sm">
                    {entry.items.map((item) => (
                      <li key={item} style={{ color: "var(--spark-text-secondary)" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ) : panel === "shortcuts" ? (
            <>
              <h2 className="text-xl font-semibold">Keyboard shortcuts</h2>
              {SHORTCUTS.map((group) => (
                <section key={group.scope} className="mt-4">
                  <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                    {group.scope}
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    {group.keys.map(([key, what]) => (
                      <div key={key} className="flex items-center justify-between gap-4 text-sm">
                        <span style={{ color: "var(--spark-text-secondary)" }}>{what}</span>
                        <kbd
                          className="text-xs px-2 py-1 rounded-md shrink-0"
                          style={{ border: "1px solid var(--spark-border)" }}
                        >
                          {key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="mt-6 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
          >
            Close
          </button>
        </div>
      </SparkOverlay>,
      document.body,
      )}
    </header>
  );
};

export default SparkTopbar;
