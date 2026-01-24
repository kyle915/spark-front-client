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

export const aiInsightsMock: AIInsightItem[] = [
  // ===========================
  // CUSTOMER FEEDBACK
  // ===========================
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

  // ===========================
  // METRIC TRENDS
  // ===========================
  {
    id: "mt-001",
    category: "Metric Trends",
    priority: "High",
    title: "Unusual Spike in Events During Q3",
    summary:
      "Event volume increased sharply compared to Q2, primarily driven by key distributors.",
    description:
      "AI correlates the spike with simultaneous promotional campaigns and seasonal patterns.",
    recommendation: "Review operational capacity and distributor alignment.",
    iconLucide: "TrendingUp",
  },
  {
    id: "mt-002",
    category: "Metric Trends",
    priority: "Medium",
    title: "Improved Conversion Rates Month-over-Month",
    summary:
      "Conversion performance rose steadily this quarter, especially in major regions.",
    description:
      "The increase is tied to optimized workflows and faster turnaround times.",
    recommendation: "Expand process improvements to low-performing sectors.",
    iconLucide: "BarChart3",
  },
  {
    id: "mt-003",
    category: "Metric Trends",
    priority: "Low",
    title: "Retailer Engagement Decline",
    summary:
      "AI detected a modest decrease in retailer interactions compared to last month.",
    description:
      "Engagement is lowest in low-density areas, suggesting geographic dependency.",
    recommendation: "Introduce incentives and distributor-driven outreach.",
    iconLucide: "Store",
  },

  // ===========================
  // PRODUCT ANALYSIS
  // ===========================
  {
    id: "pa-001",
    category: "Product Analysis",
    priority: "High",
    title: "Concerns About Packaging Durability",
    summary:
      "Increasing mentions of damaged packaging upon delivery across multiple regions.",
    description:
      "AI found a 24% rise in negative packaging comments tied to rough handling or fragile materials.",
    recommendation: "Update packaging materials to reinforced variants.",
    iconLucide: "PackageOpen",
  },
  {
    id: "pa-002",
    category: "Product Analysis",
    priority: "Medium",
    title: "Growing Preference for Multi-Pack Bundles",
    summary: "Customers prefer product bundles due to perceived higher value.",
    description:
      "Multi-pack SKUs perform 31% better in repeat purchases compared to single units.",
    recommendation: "Increase bundle availability and test seasonal bundles.",
    iconLucide: "Boxes",
  },
  {
    id: "pa-003",
    category: "Product Analysis",
    priority: "Low",
    title: "Feedback on Product Weight",
    summary:
      "Some users mentioned the product feels heavier compared to alternatives.",
    description:
      "Weight-related comments are low-priority but consistent among seniors.",
    recommendation: "Evaluate material reduction opportunities.",
    iconLucide: "Weight",
  },
];
