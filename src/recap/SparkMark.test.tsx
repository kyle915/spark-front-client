import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecapDocument } from "./RecapDocument";
import { SparkMark } from "./SparkMark";

describe("SparkMark", () => {
  it("uses the real Spark PNG and does not invert on light recaps", () => {
    const el = SparkMark({});
    expect(el.props.src).toBe("/legal/spark-logo.png");
    expect(el.props.style.filter).toBeUndefined();
  });

  it("inverts only when asked to sit on dark chrome", () => {
    const el = SparkMark({ onDark: true });
    expect(el.props.src).toBe("/legal/spark-logo.png");
    expect(String(el.props.style.filter)).toContain("invert");
  });

  it("scales SparkMark to equal optical weight alongside brand logos and wordmarks in RecapDocument", () => {
    // /legal/spark-logo.png is 719×304 with 221px vertical ink (72.7% of canvas),
    // so height=38 yields ~27.6px ink height to match a 28px (h-7) brand mark.
    const withLogo = renderToStaticMarkup(
      <RecapDocument
        brandName="Brew Dr. Kombucha"
        brandLogoUrl="https://example.com/brew-dr.png"
        status="APPROVED"
      >
        <p>Body</p>
      </RecapDocument>,
    );
    expect(withLogo).toContain('class="h-7 max-h-7 max-w-[8.5rem] w-auto object-contain shrink-0"');
    expect(withLogo).toContain("height:38px");

    const withWordmark = renderToStaticMarkup(
      <RecapDocument brandName="Brew Dr. Kombucha" status="APPROVED">
        <p>Body</p>
      </RecapDocument>,
    );
    expect(withWordmark).toContain("height:34px");
  });
});
