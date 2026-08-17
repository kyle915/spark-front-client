import { describe, expect, it } from "vitest";
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
});
