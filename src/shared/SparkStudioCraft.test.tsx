import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

vi.mock("@/hooks/useSparkRole", () => ({
  default: () => ({ isClient: false, isAdmin: true, role: "admin", canToggleRole: true }),
}));

import SparkPageHeader from "./SparkPageHeader";
import SparkInfoTip from "./SparkInfoTip";
import SparkHubTabs from "./SparkHubTabs";

describe("Spark high-agency studio primitives", () => {
  it("renders unadorned titles with optional infoTip button and no support paragraph when omitted", () => {
    const html = renderToStaticMarkup(
      <SparkPageHeader
        eyebrow="Reports · Last 90 days"
        title="Program report"
        infoTip="Consumers counted are sampled — not reach."
      />,
    );
    expect(html).toContain("Program report");
    expect(html).toContain('title="Consumers counted are sampled — not reach."');
    expect(html).not.toContain("spark-support");
  });

  it("skips empty SparkInfoTip notes cleanly", () => {
    expect(renderToStaticMarkup(<SparkInfoTip note="   " />)).toBe("");
  });

  it("renders flush underline hub tabs with active indicator", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/photo-wall"]}>
        <SparkHubTabs
          ariaLabel="Photo views"
          tabs={[
            { label: "Gallery", to: "/photos" },
            { label: "Photo wall", to: "/photo-wall" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("spark-hub-tabs");
    expect(html).toContain("spark-hub-tab whitespace-nowrap no-underline is-active");
    expect(html).toContain('aria-current="page"');
  });
});
