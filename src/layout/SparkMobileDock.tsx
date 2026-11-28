import React, { Suspense } from "react";
import { Link, useLocation } from "react-router";
import {
  BarChart3,
  CalendarRange,
  FileText,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import useSparkRole from "@/hooks/useSparkRole";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
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

const MobileDockBadgeDot: React.FC<{
  dockKey: MobileDockKey;
  isClient: boolean;
}> = ({ dockKey, isClient }) => {
  const counts = useSidebarCounts();
  let count = 0;
  if (dockKey === "home") {
    count = isClient
      ? counts.approvals
      : counts.approvals + counts.pendingWalkups;
  } else if (dockKey === "recaps") {
    count = isClient ? 0 : counts.recapsNeedsReview + counts.recapsDue;
  }
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className="absolute top-1.5 right-[calc(50%-14px)] w-2 h-2 rounded-full"
      style={{
        background: "var(--spark-orange)",
        boxShadow: "0 0 0 2px var(--spark-surface)",
      }}
    />
  );
};

export const SparkMobileDock: React.FC = () => {
  const location = useLocation();
  const { isClient } = useSparkRole();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { setOpen } = useMobileNav();

  const items = buildMobileDockItems(isClient);
  const activeKey = activeMobileDockKey(location.pathname);
  const activeIndex = items.findIndex((item) => item.key === activeKey);

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
      <div className="relative grid grid-cols-5 h-14 px-1">
        {activeIndex >= 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-1 right-1 h-0.5"
          >
            <span
              className="block h-full px-3 transition-transform duration-200"
              style={{
                width: `${100 / items.length}%`,
                transform: `translateX(${activeIndex * 100}%)`,
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <span
                className="block w-full h-full rounded-b"
                style={{ background: "var(--spark-text)" }}
              />
            </span>
          </span>
        ) : null}

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
              <Icon size={18} strokeWidth={on ? 2.1 : 1.75} />
              {(item.key === "home" || item.key === "recaps") && tenantId ? (
                <ErrorBoundary fallback={null}>
                  <Suspense fallback={null}>
                    <MobileDockBadgeDot
                      dockKey={item.key}
                      isClient={isClient}
                    />
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SparkMobileDock;
