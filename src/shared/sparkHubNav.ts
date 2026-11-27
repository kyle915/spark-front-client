export interface HubTabItem {
  label: string;
  to: string;
  adminOnly?: boolean;
  matchPaths?: readonly string[];
}

export const SCHEDULE_HUB_TABS: readonly HubTabItem[] = [
  { label: "Upcoming", to: "/upcoming" },
  { label: "Calendar", to: "/calendar" },
  { label: "Staffing", to: "/schedule", adminOnly: true },
  { label: "Live Clock", to: "/live-board", adminOnly: true },
  { label: "Today", to: "/today" },
  { label: "Confirmations", to: "/event-confirmation", adminOnly: true },
];

export const REPORTS_HUB_TABS: readonly HubTabItem[] = [
  { label: "Program", to: "/reports" },
  {
    label: "Store & Buyer",
    to: "/buyer-report",
    matchPaths: ["/buyer-report", "/retailer-pos"],
  },
  { label: "Field Sampling", to: "/field-sampling-report" },
  {
    label: "Budget & P&L",
    to: "/roi-pacing",
    matchPaths: ["/roi-pacing", "/demo-costs", "/pnl"],
  },
];

export const PHOTOS_HUB_TABS: readonly HubTabItem[] = [
  { label: "All Photos", to: "/photos" },
  { label: "Curated Wall", to: "/photo-wall" },
  { label: "Deck Pins", to: "/photo-wall?pinned=1" },
];

export const STORE_BUYER_SUBTABS: readonly HubTabItem[] = [
  { label: "Buyer Report", to: "/buyer-report" },
  { label: "Retailer POS & Lift", to: "/retailer-pos" },
];

export const BUDGET_PNL_SUBTABS: readonly HubTabItem[] = [
  { label: "Budget Pacing", to: "/roi-pacing" },
  { label: "Demo Costs", to: "/demo-costs" },
  { label: "Event P&L", to: "/pnl", adminOnly: true },
];

/** Canonical hub entry path for sibling sub-tab routes so the sidebar highlights its hub. */
export const HUB_PARENT_BY_PREFIX: ReadonlyArray<{
  hubPath: string;
  prefixes: readonly string[];
}> = [
  {
    hubPath: "/upcoming",
    prefixes: [
      "/upcoming",
      "/calendar",
      "/schedule",
      "/live-board",
      "/today",
      "/event-confirmation",
    ],
  },
  {
    hubPath: "/reports",
    prefixes: [
      "/reports",
      "/buyer-report",
      "/retailer-pos",
      "/field-sampling-report",
      "/roi-pacing",
      "/demo-costs",
      "/pnl",
    ],
  },
  {
    hubPath: "/photos",
    prefixes: ["/photos", "/photo-wall"],
  },
];
