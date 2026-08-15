import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowRightEndOnRectangleIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import NotificationBell from "./NotificationBell";
import useSparkRole from "@/hooks/useSparkRole";
import useSparkPlatform from "@/hooks/useSparkPlatform";

/**
 * Spark v2 topbar — wireframe-faithful version of spark-demo/index.html
 * lines 467–490.
 *
 *   spark.app / DASHBOARD                         [Search ⌘K] [Desktop|Mobile] [Admin|Client] avatar Logout
 */

type Platform = "desktop" | "mobile";
type Role = "admin" | "client";

const useBreadcrumb = () => {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === "/") return "DASHBOARD";
    if (pathname === "/client-dashboard") return "CLIENT";
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    return last.replace(/-/g, " ").toUpperCase();
  }, [pathname]);
};

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
  const { user, tenantMeta } = useAuthStore();
  const { showAlert } = useAlertStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const crumb = useBreadcrumb();
  const { role, isClient, setRole } = useSparkRole();
  const { platform, setPlatform } = useSparkPlatform();
  const initial = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    if (role === "client" && (pathname === "/" || pathname === "/dashboard")) {
      navigate("/client-dashboard", { replace: true });
    }
  }, [role, pathname, navigate]);

  const publicFormUrl = useMemo(() => {
    const slug = tenantMeta?.requestUrlName?.trim();
    if (!slug) return null;
    return `${window.location.origin}/spark-form/${slug}`;
  }, [tenantMeta?.requestUrlName]);

  const copyForm = async () => {
    if (!publicFormUrl) return;
    try {
      await navigator.clipboard.writeText(publicFormUrl);
      showAlert("Link copied to clipboard", "success");
    } catch {
      showAlert("Error copying link", "error");
    }
  };

  const openForm = () => {
    if (!publicFormUrl) return;
    window.open(publicFormUrl, "_blank", "noopener,noreferrer");
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const onRole = (next: Role) => {
    setRole(next);
    navigate(next === "client" ? "/client-dashboard" : "/");
  };

  const openJump = () => {
    window.dispatchEvent(new Event("spark:open-jump"));
  };

  return (
    <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-xl border-b border-base-300 px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
      {/* Left: breadcrumb + (optional) public form chip */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="mono text-[11px] tracking-[0.18em] text-base-content/40">
          spark.app /
        </span>
        <span className="mono text-[11px] tracking-[0.18em] text-primary truncate">
          {crumb}
        </span>

        {publicFormUrl && !isClient && (
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-300/40 border border-base-300 text-xs ml-2">
            <span className="text-base-content/55">Public form</span>
            <span className="font-medium text-primary truncate max-w-[140px]">
              {tenantMeta?.requestUrlName}
            </span>
            <button
              onClick={copyForm}
              className="text-primary hover:text-primary/70"
              title="Copy link"
            >
              <ClipboardIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={openForm}
              className="text-primary hover:text-primary/70"
              title="Open in new tab"
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {!isClient && (
          <button
            onClick={() => navigate("/requests/create")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-[0.98]"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
            }}
          >
            <span aria-hidden>+</span>
            <span>Create Request</span>
          </button>
        )}

        <button
          onClick={openJump}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-base-300 text-xs text-base-content/55 hover:text-primary hover:border-primary transition active:scale-[0.98]"
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          <span>Jump</span>
          <span className="hidden sm:inline ml-3 mono text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/55 border border-base-300">
            ⌘K
          </span>
        </button>

        <PillGroup
          value={platform}
          onChange={(v) => setPlatform(v as Platform)}
          options={[
            { value: "desktop", label: "Desktop", icon: "▢" },
            { value: "mobile", label: "Mobile", icon: "▯" },
          ]}
        />

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
