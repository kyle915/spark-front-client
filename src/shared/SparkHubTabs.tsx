import React from "react";
import { Link, useLocation } from "react-router";
import useSparkRole from "@/hooks/useSparkRole";
import type { HubTabItem } from "./sparkHubNav";

export const SparkHubTabs: React.FC<{
  tabs: readonly HubTabItem[];
  ariaLabel: string;
}> = ({ tabs, ariaLabel }) => {
  const { pathname, search } = useLocation();
  const { isClient } = useSparkRole();
  const visible = tabs.filter((t) => !t.adminOnly || !isClient);
  if (visible.length <= 1) return null;

  const fullUrl = `${pathname}${search}`;

  const isTabActive = (tab: HubTabItem): boolean => {
    if (tab.to.includes("?")) {
      return fullUrl === tab.to;
    }
    if (tab.to === "/photo-wall" && search.includes("pinned=1")) {
      return false;
    }
    const candidates = tab.matchPaths ?? [tab.to];
    return candidates.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  };

  return (
    <nav
      aria-label={ariaLabel}
      className="spark-hub-tabs max-w-full overflow-x-auto spark-scroll-fade print:hidden"
    >
      {visible.map((tab) => {
        const active = isTabActive(tab);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={`spark-hub-tab whitespace-nowrap no-underline ${active ? "is-active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default SparkHubTabs;
