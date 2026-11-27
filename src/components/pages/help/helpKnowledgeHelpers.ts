/**
 * Pure UI metadata, audience badges, categories, and route presets for the
 * Admin-only Spark Help Knowledge Base & Gaps console (`/help-knowledge`) and
 * `/chat` Teach Spark modal.
 */

export type HelpAudience = "all" | "client" | "admin";

export const HELP_AUDIENCE_OPTIONS: ReadonlyArray<{
  value: HelpAudience;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "Clients & Admins",
    description: "Visible to brand clients AND Ignite admins inside Ask Spark.",
  },
  {
    value: "client",
    label: "Brand Clients",
    description: "Tailored for brand users; also visible to admins.",
  },
  {
    value: "admin",
    label: "Ignite Admins Only",
    description:
      "Admin-only Spark UI how-to guides — never shown to brand clients. Never store internal Ignite financials or internal processes.",
  },
];

export const HELP_CATEGORY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "getting_started", label: "Getting Started" },
  { value: "reports", label: "Reports & Buyer Decks" },
  { value: "shelf_voice", label: "Shelf & Voice" },
  { value: "recaps", label: "Recaps & Photos" },
  { value: "requests", label: "Requests & Scheduling" },
  { value: "billing_costs", label: "Demo Costs & Pacing" },
  { value: "integrations", label: "Webhooks & AI MCP" },
  { value: "field_ui", label: "Field & Chat UI (Admin)" },
  { value: "general", label: "General" },
];

export const SPARK_ROUTE_PRESETS: ReadonlyArray<{
  path: string;
  label: string;
}> = [
  { path: "", label: "No specific page" },
  { path: "/setup-guide", label: "Open Setup Guide" },
  { path: "/shelf-voice", label: "Open Shelf & Voice" },
  { path: "/buyer-report", label: "Open Buyer Report" },
  { path: "/buyer-report?deck=1", label: "Open Buyer Deck Builder" },
  { path: "/demo-costs", label: "Open Demo Costs" },
  { path: "/roi-pacing", label: "Open Budget Pacing" },
  { path: "/retailer-pos", label: "Open Retailer POS" },
  { path: "/recaps/list", label: "Open Recaps" },
  { path: "/requests/list", label: "Open Requests" },
  { path: "/account-map", label: "Open Account Map" },
  { path: "/ai-connector", label: "Open AI Connector" },
  { path: "/workspace", label: "Open Workspace & Agencies" },
  { path: "/chat", label: "Open Chat Inbox" },
  { path: "/help", label: "Open Help & Support" },
];

export function audienceBadgeMeta(audience: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  if (audience === "admin") {
    return {
      label: "Admin only",
      bg: "rgba(210,72,27,0.10)",
      color: "var(--spark-flag-ink, #a8340f)",
      border: "rgba(210,72,27,0.30)",
    };
  }
  if (audience === "client") {
    return {
      label: "Brand clients",
      bg: "rgba(59,130,246,0.10)",
      color: "#1d4ed8",
      border: "rgba(59,130,246,0.28)",
    };
  }
  return {
    label: "Clients & Admins",
    bg: "rgba(43,76,8,0.10)",
    color: "var(--spark-ok-ink, #2b4c08)",
    border: "rgba(43,76,8,0.25)",
  };
}

export function confidenceBadgeMeta(confidence: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  if (confidence === "high") {
    return {
      label: "High confidence",
      bg: "rgba(43,76,8,0.10)",
      color: "var(--spark-ok-ink, #2b4c08)",
      border: "rgba(43,76,8,0.25)",
    };
  }
  if (confidence === "low") {
    return {
      label: "Low confidence",
      bg: "rgba(210,72,27,0.10)",
      color: "var(--spark-flag-ink, #a8340f)",
      border: "rgba(210,72,27,0.30)",
    };
  }
  return {
    label: "Medium confidence",
    bg: "rgba(180,83,9,0.10)",
    color: "#92400e",
    border: "rgba(180,83,9,0.28)",
  };
}

export function parseTagsInput(raw: string): string[] {
  return Array.from(
    new Set(
      (raw || "")
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15),
    ),
  );
}
