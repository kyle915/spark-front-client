/**
 * Structured content, code recipes, and progress helpers for the in-app
 * Spark Setup & Feature Guide (`/setup-guide`).
 *
 * Pure TypeScript module (no Relay imports) so unit tests stay CI-safe.
 */

export type SetupGuideCategory = "all" | "brand" | "integrations";

export interface SetupGuideStep {
  title: string;
  detail: string;
  to?: string;
  ctaLabel?: string;
}

export interface SetupGuideSnippet {
  label: string;
  language: string;
  code: string;
}

export interface SetupGuideTrack {
  id: string;
  category: "brand" | "integrations";
  eyebrow: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  primaryTo: string;
  primaryLabel: string;
  steps: SetupGuideStep[];
  tips?: string[];
  snippets?: SetupGuideSnippet[];
  adminOnly?: boolean;
  adminOnlyNote?: {
    title: string;
    body: string;
    code?: string;
  };
}

export const SETUP_GUIDE_TRACKS: readonly SetupGuideTrack[] = [
  {
    id: "sandbox",
    category: "brand",
    eyebrow: "Admin Preview · Fictional Demo Workspace",
    title: "Interactive Sample Brand Sandbox (Admin Only)",
    summary:
      "Internal Ignite-admin preview of Program Reports, StoreSheet, Shelf & Voice, Photo Wall, Ask Spark, and Buyer QBR Decks using fictional brand Meadowlark Botanicals and made-up store data — staged for a future public launch.",
    estimatedMinutes: 3,
    primaryTo: "/sandbox",
    primaryLabel: "Open Admin Sandbox Preview",
    adminOnly: true,
    steps: [
      {
        title: "Open the admin-only sandbox preview",
        detail:
          "Launch /sandbox while signed in as an Ignite admin to preview the fictional Meadowlark Botanicals workspace before we open it publicly.",
        to: "/sandbox",
        ctaLabel: "Launch /sandbox",
      },
      {
        title: "Test live filtering, StoreSheet, and Target MSRP drift",
        detail:
          "Click the 'Texas Greenway · Last 90d' saved-view pill, click any made-up door to open its StoreSheet drawer, and type a new Target MSRP in Shelf & Voice to watch drift badges recalculate.",
      },
      {
        title: "Try Ask Spark & export a real 16:9 PowerPoint (.pptx)",
        detail:
          "Open Ask Spark from the top sandbox bar to test grounded Q&A, then switch to Buyer QBR Deck and download a native PowerPoint deck.",
      },
    ],
    tips: [
      "Both /sandbox and its API endpoint are currently locked to Ignite admins and use 100% fictional brand, competitor, retailer, and store data.",
    ],
  },
  {
    id: "shelf-voice",
    category: "brand",
    eyebrow: "Reports · Shelf Intelligence",
    title: "Shelf Compliance, Pricing & Competitor Voice Hub",
    summary:
      "Track on-shelf availability (OSA %), flag MSRP price drift and missing shelf tags, compare Before & After repeat-visit shelf proof, and spot rising competitor mentions by market.",
    estimatedMinutes: 5,
    primaryTo: "/shelf-voice",
    primaryLabel: "Open Shelf & Voice Hub",
    steps: [
      {
        title: "Verify your recap template has a shelf or cooler photo bucket",
        detail:
          "Make sure retail recap templates include a photo category named 'Shelf', 'Cooler', or 'Display'. Spark's background vision auditor reads those photos automatically on approved recaps.",
        to: "/recaps/templates",
        ctaLabel: "Check Recap Templates",
      },
      {
        title: "Set your Target MSRP $ to flag ±5% retail price drift",
        detail:
          "Open Reports → Shelf & Voice and enter your target retail price (defaults to the observed median). Any store drifting ±5% or more is highlighted automatically.",
        to: "/shelf-voice",
        ctaLabel: "Open Shelf & Voice",
      },
      {
        title: "Filter exceptions and drill straight into StoreSheet",
        detail:
          "Use the Needs Attention, OOS / Not Found, Missing Tag, and Low Facings pills to isolate problem doors, then click any store to open its full StoreSheet history.",
      },
      {
        title: "Watch Rising Competitor Mentions by Market",
        detail:
          "Switch the period bar (30d, 90d, All) to compare competitor brand mentions against the prior window (↑ Rising / New / Steady / ↓ Cooling) alongside buyer-safe verbatim quotes.",
      },
    ],
    tips: [
      "Ambassadors' internal notes and personal identities are never exposed in Shelf & Voice — everything shown is safe to share in retail reviews.",
    ],
  },
  {
    id: "buyer-deck",
    category: "brand",
    eyebrow: "Buyer Meetings · Line Reviews",
    title: "One-Click Retail Buyer QBR / Line-Review Deck",
    summary:
      "Turn filtered store velocity, US footprint maps, 4-week POS lift halos, Shelf OSA, and curated field photos into a live buyer link and editable 16:9 PowerPoint (.pptx).",
    estimatedMinutes: 4,
    primaryTo: "/buyer-report?deck=1",
    primaryLabel: "Open Buyer Deck Builder",
    steps: [
      {
        title: "Pin your strongest field & shelf photos on the Photo Wall",
        detail:
          "Star hero activation shots on /photo-wall so your Buyer QBR Deck automatically leads with verified visual proof.",
        to: "/photo-wall",
        ctaLabel: "Curate Photo Wall",
      },
      {
        title: "Filter to the exact retailer or region for your buyer meeting",
        detail:
          "On /buyer-report, narrow by Retailer Banner (e.g. Whole Foods Market), Market (e.g. TX), or Date Window — the deck inherits your exact slice.",
        to: "/buyer-report?deck=1",
        ctaLabel: "Open Deck Builder",
      },
      {
        title: "Share a live buyer link or export native PowerPoint (.pptx)",
        detail:
          "Optionally add a buyer name, intro note, passcode, and toggle cost visibility. Click Share Link for a live web deck, or Download PowerPoint (.pptx) for Keynote / PowerPoint / Google Slides.",
      },
    ],
  },
  {
    id: "saved-views",
    category: "brand",
    eyebrow: "Regional Ops · Automated Digests",
    title: "Saved Report Views & Friday Distributor Digests",
    summary:
      "Save named regional/retailer filter slices (like 'Texas Whole Foods · Last 90d') for 1-click reuse and schedule automated Friday CSV + summary emails to brokers and distributors.",
    estimatedMinutes: 3,
    primaryTo: "/buyer-report",
    primaryLabel: "Create a Saved View",
    steps: [
      {
        title: "Set your filters on Buyer Report or Shelf & Voice",
        detail:
          "Choose a date range (30d, 90d, YTD, All, or Custom) plus retailer, market, provider, or Target MSRP filters.",
        to: "/buyer-report",
        ctaLabel: "Go to Buyer Report",
      },
      {
        title: "Click 'Save current slice' and configure the digest schedule",
        detail:
          "Give the slice a memorable name, toggle 'Schedule automated email digest', choose Weekly (Friday default), Bi-weekly, or Monthly, pick Summary + CSV attachment, and list comma-separated broker/distributor emails.",
      },
      {
        title: "Click the paper-plane icon to send a live test email now",
        detail:
          "Every saved view pill includes an immediate 'Send now' trigger so you can preview the formatted HTML summary + CSV attachment in your inbox before Friday.",
      },
    ],
    adminOnlyNote: {
      title: "Ops Cron Setup (Cloud Scheduler)",
      body: "1-click 'Send now' works immediately. To fire scheduled Friday/daily digests automatically, schedule a daily Cloud Scheduler HTTP POST to /internal/cron/send-saved-view-digests with your existing X-Cron-Secret header:",
      code: `curl -X POST "https://spark-api-new-423964904372.us-central1.run.app/internal/cron/send-saved-view-digests" \\\n  -H "X-Cron-Secret: $CRON_SECRET"`,
    },
  },
  {
    id: "webhooks",
    category: "integrations",
    eyebrow: "Automation · Zapier, HubSpot, Klaviyo, Airtable",
    title: "Outbound Webhooks (HMAC-SHA256 Signed)",
    summary:
      "Push real-time buyer-safe JSON events (recap.approved, request.created, shelf.oos_detected) straight into your CRM, Slack, Airtable, or Zapier workflows with cryptographic signature verification.",
    estimatedMinutes: 5,
    primaryTo: "/ai-connector#webhooks",
    primaryLabel: "Configure Webhooks",
    steps: [
      {
        title: "Create a webhook catch URL in Zapier, HubSpot, Klaviyo, or Airtable",
        detail:
          "In Zapier choose 'Webhooks by Zapier → Catch Hook'; in Airtable choose 'When webhook received'. Copy the HTTPS URL (must use https:// on a public host).",
      },
      {
        title: "Register the endpoint in Spark AI Connector & Webhooks",
        detail:
          "Open /ai-connector, click Add Webhook Endpoint, paste the HTTPS URL, and select the events you want: recap.approved, request.created, and/or shelf.oos_detected.",
        to: "/ai-connector#webhooks",
        ctaLabel: "Open Webhooks Panel",
      },
      {
        title: "Copy your one-time signing secret and click Test",
        detail:
          "Save the whsec_... secret shown once on creation (you can rotate it anytime). Click Test to send a signed webhook.test ping and inspect the HTTP status and latency in Recent Deliveries.",
      },
    ],
    tips: [
      "Webhook payloads never expose BA labor pay, internal staff notes, or ambassador personal contact info.",
      "Pause or resume an endpoint anytime without deleting it or rotating its secret.",
    ],
    snippets: [
      {
        label: "Sample shelf.oos_detected payload",
        language: "json",
        code: `{
  "id": "evt_9a4f8b21c3e0d1a2b4c5d6e7",
  "event": "shelf.oos_detected",
  "createdAt": "2026-11-27T18:12:04Z",
  "tenantUuid": "0195c1e0-...",
  "tenantName": "Meadowlark Botanicals",
  "data": {
    "fileId": "48291",
    "recapUuid": "0195c210-...",
    "storeName": "Greenway Market — Northgate #119",
    "eventDate": "2026-11-27",
    "productOnShelf": "no",
    "outOfStockGap": "yes",
    "priceTagVisible": "no",
    "price": "2.89",
    "facings": 0
  }
}`,
      },
      {
        label: "Verify X-Spark-Signature (Node.js)",
        language: "javascript",
        code: `import crypto from "node:crypto";

export function verifySparkWebhook(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("="))
  );
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(parts.v1 || "", "hex")
  );
}`,
      },
    ],
  },
  {
    id: "ai-connector",
    category: "integrations",
    eyebrow: "AI Workflows · Official Spark MCP",
    title: "Connect Claude or ChatGPT (Spark MCP)",
    summary:
      "Give Claude or ChatGPT secure, read-only OAuth access to your brand's approved recaps, shelf compliance, POS velocity lift, demo costs, and competitor mentions.",
    estimatedMinutes: 3,
    primaryTo: "/ai-connector",
    primaryLabel: "Open AI Connector",
    steps: [
      {
        title: "Copy your official Spark MCP Connector URL",
        detail:
          "Visit /ai-connector and copy the Connector URL at the top of the page.",
        to: "/ai-connector",
        ctaLabel: "Get Connector URL",
      },
      {
        title: "Paste into Claude or ChatGPT custom connectors",
        detail:
          "In Claude open Settings → Connectors → Add custom connector (leave OAuth fields blank). In ChatGPT enable developer mode under Settings → Apps & Connectors.",
      },
      {
        title: "Sign in with your Spark account & approve brand access",
        detail:
          "Choose your brand workspace when prompted. You can review 30-day call counts or disconnect any AI app in 1 click from /ai-connector.",
      },
    ],
  },
];

export function setupGuideStorageKey(tenantId: string | number | null | undefined): string {
  return `spark.setupGuide.completed.${tenantId ?? "default"}`;
}

export function filterSetupGuideTracks(
  tracks: readonly SetupGuideTrack[],
  category: SetupGuideCategory,
  query: string,
): SetupGuideTrack[] {
  const q = query.trim().toLowerCase();
  return tracks.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (!q) return true;
    const hay = [
      t.title,
      t.eyebrow,
      t.summary,
      ...t.steps.map((s) => `${s.title} ${s.detail}`),
      ...(t.tips ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function computeSetupGuideProgress(
  tracks: readonly SetupGuideTrack[],
  completedIds: ReadonlySet<string>,
): { done: number; total: number; pct: number } {
  const total = tracks.length;
  const done = tracks.filter((t) => completedIds.has(t.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}
