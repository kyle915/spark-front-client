/**
 * Route-aware starter prompts for the docked Ask Spark side-panel so opening
 * Ask Spark from any tab immediately offers high-signal questions for that view.
 */
export function routeAskSparkPrompts(
  pathname: string,
  isClient: boolean,
): readonly string[] {
  const clean = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (clean === "/shelf-voice") {
    return [
      "Which stores had missing price tags or MSRP price drift this period?",
      "Where are competitor mentions or promos rising fastest by market?",
      "Which doors had out-of-stock shelf readings or low facings?",
    ];
  }

  if (
    clean === "/reports" ||
    clean.startsWith("/reports/") ||
    clean === "/buyer-report" ||
    clean === "/retailer-pos" ||
    clean === "/roi-pacing" ||
    clean === "/demo-costs"
  ) {
    return [
      "Which stores dropped in samples or units vs last period?",
      "Rank our top 10 stores by conversion rate and units sold",
      "Compare sampling lift and cost efficiency by market",
    ];
  }

  if (clean === "/upcoming" || clean.startsWith("/upcoming/") || clean === "/calendar") {
    return [
      "Which upcoming activations still need attention or addresses?",
      "Summarize our scheduled footprint over the next 14 days by market",
      "Which high-performing stores have no upcoming visits booked?",
    ];
  }

  if (
    clean.startsWith("/recaps") ||
    clean.startsWith("/custom-recap") ||
    clean.startsWith("/recap/") ||
    clean === "/my-approvals" ||
    clean === "/approvals" ||
    clean.startsWith("/photos")
  ) {
    return [
      "Summarize the top shopper objections and positive feedback from recent recaps",
      "Which recent recaps had the strongest units sold per hour?",
      "Spot any recurring store execution or stockout issues across recent recaps",
    ];
  }

  if (clean === "/account-map" || clean.startsWith("/store/")) {
    return [
      "Plan next month's 15-store demo wave",
      "Which high-velocity stores haven't been activated in the last 45 days?",
      "Group our top stores by market for back-to-back weekend routing",
    ];
  }

  return isClient
    ? [
        "Summarize this month's sampling, units sold, and conversion highlights",
        "Which stores should we rebook first based on recent velocity?",
        "Plan next month's 15-store demo wave",
      ]
    : [
        "Which pending requests or markets need attention first?",
        "Summarize this month's sampling, units sold, and conversion highlights",
        "Which stores should we rebook first based on recent velocity?",
      ];
}

/**
 * Route-aware Spark Help starter prompts, cleanly tailored by Client vs. Admin.
 */
export function routeSparkHelpPrompts(
  pathname: string,
  isClient: boolean,
): readonly string[] {
  const clean = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (clean === "/demo-costs" || clean === "/roi-pacing") {
    return [
      "How do I set up demo costs and provider rate agreements?",
      "How does Budget Pacing calculate projected spend?",
      "How do I connect Claude or ChatGPT via Spark MCP?",
    ];
  }
  if (clean === "/shelf-voice") {
    return [
      "How does MSRP price drift and Shelf OSA auditing work?",
      "How do I save a filter slice and schedule Friday digests?",
      "How do I set up shelf.oos_detected webhooks?",
    ];
  }
  if (clean === "/buyer-report" || clean === "/retailer-pos") {
    return [
      "How do I export a 16:9 Buyer QBR PowerPoint (.pptx) deck?",
      "How does Retailer POS CSV velocity lift matching work?",
      "How do I schedule automated Friday broker digest emails?",
    ];
  }
  if (clean === "/ai-connector") {
    return [
      "How do I connect Claude or ChatGPT to Spark MCP?",
      "How do I set up and verify HMAC-SHA256 outbound webhooks?",
      "What events trigger Spark webhooks?",
    ];
  }
  if (!isClient && clean === "/chat") {
    return [
      "How do AI draft replies and Teach Spark work in Chat?",
      "How do I filter exceptions and MSRP drift in Shelf & Voice?",
      "How do I export a Buyer QBR PowerPoint (.pptx) deck?",
    ];
  }
  return isClient
    ? [
        "How does this page work?",
        "How do I export a Buyer QBR PowerPoint (.pptx) deck?",
        "How do I set up Friday broker digests or Zapier webhooks?",
      ]
    : [
        "How does this page work?",
        "How do I use the Missing Recaps and Recap Flag views?",
        "How do I preview the admin Sample Brand Sandbox?",
      ];
}
