export interface AIInsightItem {
  id: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  title: string;
  summary: string;
  recommendation: string;
  description: string;
  iconLucide: string;
}

export const aiInsightsMockV2: AIInsightItem[] = [
  // ============================================================
  // CUSTOMER FEEDBACK ANALYSIS
  // ============================================================
  {
    id: "cf-001",
    category: "Customer Feedback",
    priority: "High",
    title: "Flavor exceeds expectations for a low-calorie soda",
    summary:
      "",
    description:
      "Consumers consistently report being positively surprised by the flavor quality, noting that the drinks do not taste like traditional “diet” or “health” sodas. Flavors are perceived as bold, clean, and smooth, often compared favorably to classic sodas.",
    recommendation:
      "",
    iconLucide: "MessageSquare",
  },
  {
    id: "cf-002",
    category: "Customer Feedback",
    priority: "Medium",
    title: "Health benefits drive re-entry into the soda category",
    summary:
      "",
    description:
      "Consumers consistently report being positively surprised by the flavor quality, noting that the drinks do not taste like traditional “diet” or “health” sodas. Flavors are perceived as bold, clean, and smooth, often compared favorably to classic sodas.",
    recommendation:
      "",
    iconLucide: "Hourglass",
  },
  {
    id: "cf-003",
    category: "Customer Feedback",
    priority: "Medium",
    title: "Health benefits drive re-entry into the soda category",
    summary:
      "",
    description:
      "Several consumers who previously avoided soda due to sugar or calories expressed excitement about finding a flavorful, low-calorie alternative that fits their health goals.",
    recommendation:
      "",
    iconLucide: "Mic",
  },
  {
    id: "cf-004",
    category: "Customer Feedback",
    priority: "Low",
    title: "Brand attracts, flavor converts",
    summary:
      "",
    description:
      "Branding initially captures attention, but flavor experience is the primary driver of trust and purchase intent.",
    recommendation: "",
    iconLucide: "Smartphone",
  },
  // ============================================================
  // METRIC BEHAVIOR & TRENDS
  // ============================================================
  {
    id: "mt-001",
    category: "Metric Trends",
    priority: "High",
    title: "Conversion rates spike in Q2",
    summary:
      "Across regions, Q2 conversions are up 18% over Q1, led by urban markets.",
    description:
      "Conversion improvements appear driven by synchronized promotions and increased consumer sampling events.",
    recommendation:
      "Scale high-performing promotional tactics across all regions.",
    iconLucide: "TrendingUp",
  },
  {
    id: "mt-002",
    category: "Metric Trends",
    priority: "Medium",
    title: "Engagement peaks during midweek demos",
    summary: "Demos on Tuesdays and Wednesdays average 27% more interactions.",
    description:
      "Customers show stronger participation mid-week, likely due to routine shopping cycles.",
    recommendation: "Shift more key activations to Tuesday/Wednesday windows.",
    iconLucide: "CalendarDays",
  },
  {
    id: "mt-003",
    category: "Metric Trends",
    priority: "Medium",
    title: "Decline in morning attendance",
    summary:
      "Morning activations show 35% lower foot traffic compared to afternoon slots.",
    description:
      "Engagement declines significantly before noon, reducing conversion effectiveness.",
    recommendation: "Prioritize afternoon events to maximize visibility.",
    iconLucide: "Sunset",
  },
  {
    id: "mt-004",
    category: "Metric Trends",
    priority: "Low",
    title: "Consistent drop in repeat visitors",
    summary:
      "Repeat visitor rates have declined by 12% month-over-month since June.",
    description:
      "Long-term retention is weakening, especially in suburban regions.",
    recommendation:
      "Implement localized loyalty incentives to rebuild frequency.",
    iconLucide: "RefreshCw",
  },

  // ============================================================
  // PRODUCT COMMENTS ANALYSIS
  // ============================================================
  {
    id: "pc-001",
    category: "Product Analysis",
    priority: "High",
    title: "Packaging design boosts appeal",
    summary:
      "New matte packaging increased product engagement by 23% in in-store demos.",
    description:
      "AI indicates matte packaging draws more attention and increases pick-ups during demos.",
    recommendation: "Roll out matte packaging across broader SKU lines.",
    iconLucide: "Package",
  },
  {
    id: "pc-002",
    category: "Product Analysis",
    priority: "Medium",
    title: "Ingredient transparency drives trust",
    summary:
      "Products highlighting natural ingredients show 32% more positive feedback.",
    description:
      "Consumers respond well to ingredient clarity, especially in health-focused markets.",
    recommendation: "Enhance packaging callouts for natural ingredients.",
    iconLucide: "Leaf",
  },
  {
    id: "pc-003",
    category: "Product Analysis",
    priority: "Medium",
    title: "Confusion over product variants",
    summary:
      "30% of feedback mentions difficulty distinguishing between product variants.",
    description:
      "SKU similarity creates confusion and slows purchasing decisions.",
    recommendation:
      "Improve color coding, naming conventions, and shelf signage.",
    iconLucide: "Layers",
  },
  {
    id: "pc-004",
    category: "Product Analysis",
    priority: "Low",
    title: "QR-code usage remains low",
    summary:
      "Only 8% of consumers scan product QR codes despite prominent placement.",
    description:
      "Consumers continue to ignore QR touchpoints during demos and retail visits.",
    recommendation:
      "Test incentives for QR engagement such as discounts or rewards.",
    iconLucide: "QrCode",
  },
];
