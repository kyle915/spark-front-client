import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowRightEndOnRectangleIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import NotificationBell from "./NotificationBell";
import useSparkRole from "@/hooks/useSparkRole";
import { looksLikeRouteId, usePageCrumb } from "./pageCrumb";
import { dispatchOpenJump } from "@/motion/opsMotion";
import { PublicFormPill } from "./PublicFormPill";
import { usePublicFormLink } from "@/hooks/usePublicFormLink";
import { useMobileNav } from "./MobileNavContext";
import { TenantLogo } from "./TenantLogo.tsx";

/**
 * Spark v2 topbar — wireframe-faithful version of spark-demo/index.html
 * lines 467–490.
 *
 *   spark.app / DASHBOARD                         [Search ⌘K] [Admin|Client] avatar Logout
 */

type Role = "admin" | "client";

type CrumbParts = { parent: string; current: string };

const useBreadcrumb = (): CrumbParts => {
  const { pathname } = useLocation();
  const pageCrumb = usePageCrumb();
  return useMemo(() => {
    if (pageCrumb) {
      return { parent: pageCrumb.parent, current: pageCrumb.title };
    }
    if (
      pathname === "/" ||
      pathname === "/insights" ||
      pathname === "/client-dashboard"
    ) {
      return { parent: "Spark", current: "Dashboard" };
    }
    const parts = pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (looksLikeRouteId(last)) {
      const parent = parts[parts.length - 2] ?? "page";
      return {
        parent: parent.replace(/-/g, " "),
        current: "Detail",
      };
    }
    const current = last.replace(/-/g, " ");
    const parent =
      parts.length > 1
        ? parts[parts.length - 2].replace(/-/g, " ")
        : "Spark";
    return { parent, current };
  }, [pathname, pageCrumb]);
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

/** Pill-group toggle (lime fill on active, mono label). */
const PillGroup: React.FC<{
  options: { value: string; label: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="inline-flex items-center bg-base-300/40 border border-base-300 rounded-full p-0.5">
    {options.map((o) => {
      const on = o.value === value;
      return (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            "px-3 py-1 rounded-full text-xs transition flex items-center gap-1.5 active:scale-[0.98]",
            on
              ? "bg-primary text-primary-content font-semibold"
              : "text-base-content/65 hover:text-base-content",
          ].join(" ")}
        >
          {o.icon && (
            <span className="mono text-[11px]" aria-hidden>
              {o.icon}
            </span>
          )}
          <span>{o.label}</span>
        </button>
      );
    })}
  </div>
);

export const SparkTopbar: React.FC = () => {
  const { user, tenantMeta, tenantSlug } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const crumb = useBreadcrumb();
  const { role, isClient, setRole, canToggleRole } = useSparkRole();
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
    <header className="sticky top-0 z-30 bg-base-200/55 backdrop-blur-[20px] border-b border-base-300 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3 flex-nowrap md:flex-wrap" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)", WebkitBackdropFilter: "saturate(180%) blur(20px)", backdropFilter: "saturate(180%) blur(20px)" }}>
      {/* Left: menu + quiet breadcrumb + (optional) public share-link pill */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          className="md:hidden btn btn-ghost btn-sm btn-square shrink-0"
          style={{ minWidth: "var(--spark-hit, 44px)", minHeight: "var(--spark-hit, 44px)" }}
          aria-label="Open menu"
          onClick={toggleNav}
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        {isClient ? (
          <TenantLogo
            variant="header"
            tone="dark"
            name={tenantMeta?.requestUrlName}
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
          <span className="spark-crumb-root hidden sm:inline">
            {crumb.parent}
          </span>
          <span className="spark-crumb-sep hidden sm:inline" aria-hidden>
            /
          </span>
          <span className="spark-crumb-current">{crumb.current}</span>
        </nav>
        </div>

        {!isClient && clientName ? (
          <span
            className="inline-flex md:hidden items-center px-2.5 py-1 rounded-full text-xs font-medium truncate max-w-[130px]"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
            title={`Working in ${clientName}. Switch clients from the sidebar.`}
          >
            {clientName}
          </span>
        ) : null}

        <div className="hidden lg:block">
          <Suspense fallback={null}>
            <PublicFormPillSlot className="ml-2" />
          </Suspense>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 md:flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/requests/create")}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-[0.98]"
          aria-label="Create Request"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
          }}
          title={
            isClient
              ? "Create a request in Spark for the current client tenant"
              : "Create a request in Spark"
          }
        >
          <span aria-hidden>+</span>
          <span className="hidden sm:inline">Create Request</span>
          <span className="sm:hidden">New</span>
        </button>

        <button
          type="button"
          data-spark-jump
          onClick={(e) => openJump(e.currentTarget)}
          className="spark-focus-ring flex items-center gap-2 px-3 py-1.5 rounded-full border border-base-300 text-xs text-base-content/55 hover:text-primary hover:border-primary transition active:scale-[0.98]"
          aria-label="Jump to a page or recap"
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Jump</span>
          <span className="hidden sm:inline ml-3 mono text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/55 border border-base-300">
            ⌘K
          </span>
        </button>

        {canToggleRole ? (
          <div className="hidden md:block">
          <PillGroup
            value={role}
            onChange={(v) => onRole(v as Role)}
            options={[
              { value: "admin", label: "Admin", icon: "⚒" },
              { value: "client", label: "Client", icon: "◐" },
            ]}
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
            aria-label="Account menu"
            className="spark-focus-ring w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center"
          >
            {initial}
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
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {user.email}
                </p>
              ) : null}
              {!isClient && clientName ? (
                <p
                  className="text-xs mt-2 truncate"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Client: {clientName}
                </p>
              ) : null}
              {canToggleRole ? (
                <div className="mt-3 md:hidden">
                  <p
                    className="text-xs mb-1.5"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    View as
                  </p>
                  <PillGroup
                    value={role}
                    onChange={(v) => {
                      setMenuOpen(false);
                      onRole(v as Role);
                    }}
                    options={[
                      { value: "admin", label: "Admin" },
                      { value: "client", label: "Client" },
                    ]}
                  />
                </div>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:text-error"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default SparkTopbar;
