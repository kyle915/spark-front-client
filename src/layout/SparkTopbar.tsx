import React, { Suspense, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowRightEndOnRectangleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import NotificationBell from "./NotificationBell";
import useSparkRole from "@/hooks/useSparkRole";
import { looksLikeRouteId, usePageCrumb } from "./pageCrumb";
import { dispatchOpenJump } from "@/motion/opsMotion";
import { PublicFormPill } from "./PublicFormPill";
import { usePublicFormLink } from "@/hooks/usePublicFormLink";

/**
 * Spark v2 topbar — wireframe-faithful version of spark-demo/index.html
 * lines 467–490.
 *
 *   spark.app / DASHBOARD                         [Search ⌘K] [Admin|Client] avatar Logout
 */

type Role = "admin" | "client";

const useBreadcrumb = () => {
  const { pathname } = useLocation();
  const pageCrumb = usePageCrumb();
  return useMemo(() => {
    if (pageCrumb) return `${pageCrumb.parent} / ${pageCrumb.title}`;
    if (pathname === "/") return "DASHBOARD";
    if (pathname === "/insights") return "INSIGHTS";
    if (pathname === "/client-dashboard") return "CLIENT";
    const parts = pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (looksLikeRouteId(last)) {
      const parent = parts[parts.length - 2] ?? "page";
      return parent.replace(/-/g, " ").toUpperCase();
    }
    return last.replace(/-/g, " ").toUpperCase();
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
  const { user } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const crumb = useBreadcrumb();
  const { role, isClient, setRole } = useSparkRole();
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
    <header className="sticky top-0 z-30 bg-base-200/50 backdrop-blur-2xl border-b border-base-300 px-6 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
      {/* Left: breadcrumb + (optional) public event-request CTA */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="mono text-[11px] tracking-[0.18em] text-base-content/40">
          spark.app /
        </span>
        <span className="mono text-[11px] tracking-[0.18em] text-primary truncate">
          {crumb}
        </span>

        <Suspense fallback={null}>
          <PublicFormPillSlot className="ml-2" />
        </Suspense>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {!isClient && (
          <button
            onClick={() => navigate("/requests/create")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-[0.98]"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
            }}
          >
            <span aria-hidden>+</span>
            <span>Create Request</span>
          </button>
        )}

        <button
          data-spark-jump
          onClick={(e) => openJump(e.currentTarget)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-base-300 text-xs text-base-content/55 hover:text-primary hover:border-primary transition active:scale-[0.98]"
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
