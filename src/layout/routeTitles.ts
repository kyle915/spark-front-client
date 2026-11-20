/**
 * Human page names for the top-bar breadcrumb and the browser tab title.
 *
 * Without this the crumb was the last URL segment ("list", "missing",
 * "live board") and every tab was titled "Spark by Ignite".
 */
type RouteTitle = { parent: string; title: string; clientTitle?: string };

const ROUTE_TITLES: Record<string, RouteTitle> = {
  "/": { parent: "Spark", title: "Dashboard" },
  "/insights": { parent: "Spark", title: "Dashboard" },
  "/client-dashboard": { parent: "Spark", title: "Dashboard" },
  "/today": { parent: "Today", title: "Today" },
  "/upcoming": { parent: "Today", title: "Upcoming" },
  "/ai-connector": { parent: "Workspace", title: "AI connector" },
  "/help/ai-connector": { parent: "Workspace", title: "AI connector" },
  "/live-board": { parent: "Today", title: "On the Clock" },
  "/schedule": { parent: "Today", title: "Staffing Board" },
  "/event-confirmation": { parent: "Today", title: "Event Confirmation" },
  "/recaps/list": { parent: "Recaps", title: "Recaps", clientTitle: "My Recaps" },
  "/recaps/missing": { parent: "Recaps", title: "Missing Recaps" },
  "/recaps/templates": { parent: "Build", title: "Recap Templates" },
  "/recap/create": { parent: "Recaps", title: "New Recap" },
  "/receipts": { parent: "Recaps", title: "Receipts" },
  "/receipt-checks": { parent: "Recaps", title: "Receipt checks" },
  "/photos": { parent: "Recaps", title: "Photos" },
  "/requests/list": { parent: "Requests", title: "Master Tracker", clientTitle: "My Requests" },
  "/requests/create": { parent: "Requests", title: "Create Request" },
  "/requests/bulk-upload": { parent: "Requests", title: "Bulk Upload" },
  "/plans": { parent: "Requests", title: "Plans" },
  "/approvals": { parent: "Review", title: "Approvals" },
  "/my-approvals": { parent: "Review", title: "Approvals" },
  "/walkups": { parent: "Review", title: "Walk-ups" },
  "/people": { parent: "People", title: "People" },
  "/people/pending": { parent: "People", title: "Pending Ambassadors" },
  "/talent": { parent: "People", title: "Search Talent" },
  "/favorites": { parent: "People", title: "Favorites" },
  "/team": { parent: "People", title: "Team" },
  "/timesheet": { parent: "Pay", title: "Timesheet" },
  "/payroll": { parent: "Pay", title: "Payroll · Hours" },
  "/payments": { parent: "Pay", title: "Payments" },
  "/campaign-cost": { parent: "Pay", title: "Campaign Cost" },
  "/pnl": { parent: "Pay", title: "P&L" },
  "/jobs": { parent: "Workspace", title: "Jobs" },
  "/recent": { parent: "Workspace", title: "Recent Submissions" },
  "/chat": { parent: "Workspace", title: "Chat" },
  "/connect-calendar": { parent: "Workspace", title: "Calendar" },
  "/account-map": { parent: "Workspace", title: "Account Map" },
  "/catalogs/store-names": { parent: "Catalogs", title: "Store names" },
  "/reports": { parent: "Spark", title: "Program report" },
  "/reports/client-recap": { parent: "Program report", title: "Client recap deck" },
  "/field-sampling-report": { parent: "Reports", title: "Field Sampling Report" },
  "/announcements": { parent: "Communication", title: "Announcements" },
  "/inbox": { parent: "Communication", title: "Inbox" },
  "/alerts": { parent: "Communication", title: "Alerts" },
  "/email-preferences": { parent: "Account", title: "Email preferences" },
  "/academy": { parent: "People", title: "Spark Academy" },
  "/academy/manage": { parent: "People", title: "Manage Library" },
  "/forms/builder": { parent: "Build", title: "Form Builder" },
  "/products/products-list": { parent: "Build", title: "Products" },
  "/clients": { parent: "Build", title: "Clients" },
  "/clients/new": { parent: "Build", title: "New Client" },
  "/system-health": { parent: "System", title: "System Health" },
  "/settings": { parent: "System", title: "Settings" },
  "/settings/calendar": { parent: "System", title: "Calendar Sync" },
  "/billing": { parent: "System", title: "Billing" },
  "/help": { parent: "System", title: "Help" },
};

const titleCase = (s: string) =>
  s
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function routeTitleFor(
  pathname: string,
  opts: { isClient?: boolean } = {},
): { parent: string; title: string } | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const hit = ROUTE_TITLES[clean];
  if (!hit) return null;
  return {
    parent: hit.parent,
    title: opts.isClient && hit.clientTitle ? hit.clientTitle : hit.title,
  };
}

/** Fallback for routes not in the table: "live-board" → "Live Board". */
export function humanizeSegment(segment: string): string {
  return titleCase(segment);
}

/** Browser tab title for a page name. */
export function documentTitleFor(pageTitle: string | null | undefined): string {
  const t = (pageTitle ?? "").trim();
  return t ? `${t} · Spark` : "Spark by Ignite";
}
