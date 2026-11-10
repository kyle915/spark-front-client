import { describe, expect, it } from "vitest";
import { FEEDBACK_RECIPIENTS, feedbackMailto } from "./whatsNew";

describe("feedbackMailto", () => {
  it("addresses both product owners and carries the page", () => {
    const href = feedbackMailto({
      pageTitle: "Staffing Board",
      pageUrl: "https://client.igniteproductions.co/schedule",
      clientName: "Pivot Energy Drink",
    });
    expect(href.startsWith(`mailto:${FEEDBACK_RECIPIENTS.join(",")}?`)).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Spark feedback — Staffing Board");
    expect(decoded).toContain("Link: https://client.igniteproductions.co/schedule");
    expect(decoded).toContain("Client: Pivot Energy Drink");
  });
  it("omits the client line when unknown", () => {
    const decoded = decodeURIComponent(
      feedbackMailto({ pageTitle: "Recaps", pageUrl: "https://x/recaps/list" }),
    );
    expect(decoded).not.toContain("Client:");
  });
});
