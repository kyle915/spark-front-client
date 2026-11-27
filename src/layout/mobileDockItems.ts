export type MobileDockKey =
  | "home"
  | "schedule"
  | "recaps"
  | "reports"
  | "ask";

export interface MobileDockItem {
  key: MobileDockKey;
  label: string;
  to?: string;
  action?: "ask-spark";
}

export function buildMobileDockItems(isClient: boolean): MobileDockItem[] {
  return [
    {
      key: "home",
      label: "Home",
      to: isClient ? "/client-dashboard" : "/",
    },
    {
      key: "schedule",
      label: "Schedule",
      to: "/upcoming",
    },
    {
      key: "recaps",
      label: "Recaps",
      to: "/recaps/list",
    },
    {
      key: "reports",
      label: "Reports",
      to: "/reports",
    },
    {
      key: "ask",
      label: "Ask Spark",
      action: "ask-spark",
    },
  ];
}

const SCHEDULE_PATHS = new Set([
  "/upcoming",
  "/calendar",
  "/schedule",
  "/live-board",
  "/today",
  "/event-confirmation",
]);

const REPORT_PATHS = new Set([
  "/reports",
  "/buyer-report",
  "/retailer-pos",
  "/shelf-voice",
  "/field-sampling-report",
  "/roi-pacing",
  "/demo-costs",
  "/pnl",
  "/finance-queue",
  "/provider-imports",
]);

export function activeMobileDockKey(pathname: string): MobileDockKey | null {
  const clean = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "/dashboard" || clean === "/client-dashboard") {
    return "home";
  }
  if (SCHEDULE_PATHS.has(clean) || clean.startsWith("/upcoming/")) {
    return "schedule";
  }
  if (
    clean.startsWith("/recaps") ||
    clean.startsWith("/custom-recap") ||
    clean.startsWith("/recap/") ||
    clean === "/photos" ||
    clean.startsWith("/photos/") ||
    clean === "/photo-wall"
  ) {
    return "recaps";
  }
  if (REPORT_PATHS.has(clean) || clean.startsWith("/reports/")) {
    return "reports";
  }
  return null;
}
