import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSparkOnboardingUrl,
  captureOnboardingMarketingUtm,
  readUtmFromSearchParams,
  sanitizeCampaignValue,
  utmMutationVariables,
} from "./marketingUtm";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  memory.clear();
});

describe("marketingUtm", () => {
  it("sanitizes campaign values like ig-routes", () => {
    expect(sanitizeCampaignValue("utm_source", "google")).toBe("google");
    expect(sanitizeCampaignValue("utm_source", "bad@email.com")).toBeNull();
    expect(sanitizeCampaignValue("utm_source", "555-123-4567")).toBeNull();
    expect(sanitizeCampaignValue("utm_id", "abc-123")).toBe("abc-123");
  });

  it("reads UTMs from search params", () => {
    const params = new URLSearchParams(
      "utm_source=ignite_web&utm_campaign=spark-pricing&utm_content=start_free&junk=1",
    );
    expect(readUtmFromSearchParams(params)).toEqual({
      utm_source: "ignite_web",
      utm_campaign: "spark-pricing",
      utm_content: "start_free",
    });
  });

  it("persists UTMs in sessionStorage and resumes them", () => {
    const first = captureOnboardingMarketingUtm(
      new URLSearchParams("utm_source=google&utm_medium=cpc"),
    );
    expect(first).toEqual({ utm_source: "google", utm_medium: "cpc" });
    const resumed = captureOnboardingMarketingUtm(new URLSearchParams(""));
    expect(resumed).toEqual({ utm_source: "google", utm_medium: "cpc" });
  });

  it("maps UTMs into GraphQL mutation variables", () => {
    expect(
      utmMutationVariables({
        utm_source: "ignite_web",
        utm_campaign: "spark-pricing",
      }),
    ).toEqual({
      utmSource: "ignite_web",
      utmMedium: "",
      utmCampaign: "spark-pricing",
      utmId: "",
      utmContent: "",
      utmTerm: "",
    });
  });

  it("builds admin onboarding URLs with defaults + current page UTMs", () => {
    const url = buildSparkOnboardingUrl(
      {
        utm_source: "ignite_web",
        utm_medium: "spark_marketing",
        utm_campaign: "spark-pricing",
        utm_content: "start_free",
      },
      new URLSearchParams("utm_term=beverage"),
    );
    expect(url).toContain("https://admin.igniteproductions.co/onboarding?");
    expect(url).toContain("utm_source=ignite_web");
    expect(url).toContain("utm_campaign=spark-pricing");
    expect(url).toContain("utm_term=beverage");
  });
});
