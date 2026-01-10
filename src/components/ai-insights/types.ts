export interface AIInsightItem {
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  category: string;
  iconLucide: string;
}
