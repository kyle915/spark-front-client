import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router";
import useSparkRole from "@/hooks/useSparkRole";
import type { HubTabItem } from "./sparkHubNav";

export const SparkHubTabs: React.FC<{
  tabs: readonly HubTabItem[];
  ariaLabel: string;
}> = ({ tabs, ariaLabel }) => {
  const { pathname, search } = useLocation();
  const { isClient } = useSparkRole();
  const visible = useMemo(
    () => tabs.filter((t) => !t.adminOnly || !isClient),
    [tabs, isClient],
  );
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    visible: boolean;
  }>({ left: 0, width: 0, visible: false });

  const fullUrl = `${pathname}${search}`;

  const isTabActive = useCallback(
    (tab: HubTabItem): boolean => {
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
    },
    [fullUrl, pathname, search],
  );

  const activeKey = visible.find(isTabActive)?.to ?? null;

  const measure = useCallback(() => {
    const el = activeKey ? linkRefs.current[activeKey] : null;
    if (!el || el.offsetWidth <= 0) {
      setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    setIndicator({
      left: el.offsetLeft,
      width: el.offsetWidth,
      visible: true,
    });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure, visible]);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  if (visible.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={`spark-hub-tabs ${indicator.visible ? "has-hub-indicator " : ""}max-w-full overflow-x-auto spark-scroll-fade print:hidden`}
    >
      {indicator.visible ? (
        <span
          aria-hidden="true"
          className="spark-hub-indicator"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      ) : null}
      {visible.map((tab) => {
        const active = isTabActive(tab);
        return (
          <Link
            key={tab.to}
            ref={(node) => {
              linkRefs.current[tab.to] = node;
            }}
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
