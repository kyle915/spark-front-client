import React, { Suspense, useEffect, useMemo } from "react";
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
  const { role, isClient, setRole } = useSparkRole();
  const { toggle: toggleNav } = useMobileNav();
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    if (role === "client" && (pathname === "/" || pathname === "/dashboard")) {
      navigate("/client-dashboard", { replace: true });
    }
  }, [role, pathname, navigate]);

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
    <header className="sticky top-0 z-30 bg-base-200/55 backdrop-blur-[20px] border-b border-base-300 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)", WebkitBackdropFilter: "saturate(180%) blur(20px)", backdropFilter: "saturate(180%) blur(20px)" }}>
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
        <nav className="spark-crumb min-w-0" aria-label="Breadcrumb">
          <span className="spark-crumb-root hidden sm:inline">
            {crumb.parent}
          </span>
          <span className="spark-crumb-sep hidden sm:inline" aria-hidden>
            /
          </span>
          <span className="spark-crumb-current">{crumb.current}</span>
        </nav>

        <Suspense fallback={null}>
          <PublicFormPillSlot className="ml-2" />
        </Suspense>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/requests/create")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-[0.98]"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
          }}
          title={
            isClient
              ? "Create a request in Spark for the current client tenant"
              : "Create a request in Spark"
          }
        >
          <span aria-hidden>+</span>
          <span>Create Request</span>
        </button>

        <button
          type="button"
          data-spark-jump
          onClick={(e) => openJump(e.currentTarget)}
          className="spark-focus-ring flex items-center gap-2 px-3 py-1.5 rounded-full border border-base-300 text-xs text-base-content/55 hover:text-primary hover:border-primary transition active:scale-[0.98]"
          aria-label="Jump to a page or recap"
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          <span>Jump</span>
          <span className="hidden sm:inline ml-3 mono text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/55 border border-base-300">
            ⌘K
          </span>
        </button>

        <PillGroup
          value={role}
          onChange={(v) => onRole(v as Role)}
          options={[
            { value: "admin", label: "Admin", icon: "⚒" },
            { value: "client", label: "Client", icon: "◐" },
          ]}
        />

        <NotificationBell />

        <div className="w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center">
          {initial}
        </div>

        <button
          onClick={onLogout}
          className="btn btn-ghost btn-sm text-base-content hover:text-error flex items-center gap-1"
        >
          <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
          <span className="hidden md:block">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default SparkTopbar;
