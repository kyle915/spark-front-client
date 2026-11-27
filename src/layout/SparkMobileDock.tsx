import React from "react";
import { Link, useLocation } from "react-router";
import {
  BarChart3,
  CalendarRange,
  FileText,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { dispatchOpenAskSpark } from "@/lib/askSparkEvent";
import { useMobileNav } from "./MobileNavContext";
import {
  activeMobileDockKey,
  buildMobileDockItems,
  type MobileDockKey,
} from "./mobileDockItems";

const DOCK_ICONS: Record<
  MobileDockKey,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  home: LayoutDashboard,
  schedule: CalendarRange,
  recaps: FileText,
  reports: BarChart3,
  ask: Sparkles,
};

export const SparkMobileDock: React.FC = () => {
  const location = useLocation();
  const { isClient } = useSparkRole();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { setOpen } = useMobileNav();

  const items = buildMobileDockItems(isClient);
  const activeKey = activeMobileDockKey(location.pathname);

  return (
    <nav
      aria-label="Mobile quick navigation"
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30"
      style={{
        background: "color-mix(in srgb, var(--spark-surface) 92%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid var(--spark-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="grid grid-cols-5 h-14 px-1">
        {items.map((item) => {
          const Icon = DOCK_ICONS[item.key];
          const on = activeKey === item.key;
          const color = on ? "var(--spark-text)" : "var(--spark-text-meta)";

          if (item.action === "ask-spark") {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  dispatchOpenAskSpark({
                    tenantId: tenantId ? String(tenantId) : undefined,
                  });
                }}
                className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium leading-none transition cursor-pointer"
                style={{ color }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              to={item.to ?? "/"}
              aria-current={on ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`relative flex flex-col items-center justify-center gap-1 text-[10.5px] leading-none no-underline transition ${
                on ? "font-semibold" : "font-medium"
              }`}
              style={{ color }}
            >
              {on ? (
                <span
                  aria-hidden
                  className="absolute top-0 left-3 right-3 h-0.5 rounded-b"
                  style={{ background: "var(--spark-text)" }}
                />
              ) : null}
              <Icon size={18} strokeWidth={on ? 2.1 : 1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SparkMobileDock;
