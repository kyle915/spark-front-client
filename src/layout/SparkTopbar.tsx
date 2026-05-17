import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowRightEndOnRectangleIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 topbar — wireframe-faithful version of spark-demo/index.html
 * (lines 467–490). Sticky, blur, monospace breadcrumb, ⌘K stub, public-form
 * link chip, user avatar + logout.
 *
 * The ⌘K palette itself ships in a follow-up (CommandPalette). For now the
 * button is a visible affordance; click is a no-op stub.
 */

const useBreadcrumb = () => {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === "/") return "DASHBOARD";
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    return last.replace(/-/g, " ").toUpperCase();
  }, [pathname]);
};

export const SparkTopbar: React.FC = () => {
  const { user, tenantMeta } = useAuthStore();
  const { showAlert } = useAlertStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const crumb = useBreadcrumb();
  const initial = (user?.firstName ?? user?.email ?? "U").charAt(0).toUpperCase();

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

  return (
    <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-xl border-b border-base-300 px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
      {/* Left: breadcrumb + public form chip */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="mono text-[11px] tracking-[0.18em] text-base-content/40">
          spark.app /
        </span>
        <span className="mono text-[11px] tracking-[0.18em] text-primary truncate">
          {crumb}
        </span>

        {publicFormUrl && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-300/40 border border-base-300 text-xs ml-2">
            <span className="text-base-content/55">Public form</span>
            <span className="font-medium text-primary truncate max-w-[180px]">
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

      {/* Right: search stub + user + logout */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() =>
            showAlert("⌘K palette coming in next session", "success")
          }
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-base-300 text-xs text-base-content/55 hover:text-primary hover:border-primary transition"
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          <span>Search</span>
          <span className="ml-3 mono text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/55 border border-base-300">
            ⌘K
          </span>
        </button>

        <div className="w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center">
          {initial}
        </div>

        <button
          onClick={onLogout}
          className="btn btn-ghost btn-sm text-base-content hover:text-error flex items-center gap-1"
        >
          <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default SparkTopbar;
