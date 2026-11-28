import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  askSparkPendingStage,
  formatGroundingSummary,
} from "../components/ai/askSparkGrounding";
import { ActiveFilterStrip } from "../shared/ActiveFilterStrip";
import { ChipInput } from "./ChipInput";
import {
  joinCsvTokens,
  normalizeChipToken,
  splitCsvTokens,
  validateChipToken,
} from "./chipInputHelpers";
import { LikeBurst } from "./LikeBurst";
import { OdometerReadout } from "./OdometerStepper";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { evaluatePasswordStrength } from "./passwordStrength";
import { PlanPickerCard, TideProgress } from "./PlanAndTideMoments";
import { buildSparklinePath } from "./sparklineMath";
import {
  KpiDeltaBadge,
  MiniSparkline,
  StudioKpiSkeleton,
} from "./StudioKpiCard";
import { resolveTideTone } from "./tideHelpers";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

describe("Wave 2 UI Moments & BoardUI-inspired enhancements (Relay-free)", () => {
  it("exports all Wave 2 components cleanly", () => {
    expect(typeof ChipInput).toBe("function");
    expect(typeof OdometerReadout).toBe("function");
    expect(typeof PlanPickerCard).toBe("function");
    expect(typeof TideProgress).toBe("function");
    expect(typeof PasswordStrengthMeter).toBe("function");
    expect(typeof LikeBurst).toBe("function");
    expect(typeof ActiveFilterStrip).toBe("function");
    expect(typeof KpiDeltaBadge).toBe("function");
    expect(typeof MiniSparkline).toBe("function");
    expect(typeof StudioKpiSkeleton).toBe("function");
  });

  it("normalizes, deduplicates, and validates ChipInput tokens across email, state, and text modes", () => {
    expect(
      splitCsvTokens("VP@Brand.com, founder@brand.com; vp@brand.com", "email"),
    ).toEqual(["vp@brand.com", "founder@brand.com"]);
    expect(splitCsvTokens("tx, ok, TX", "state")).toEqual(["TX", "OK"]);
    expect(joinCsvTokens(["H-E-B", "Whole Foods"])).toBe("H-E-B, Whole Foods");
    expect(normalizeChipToken("  ca ", "state")).toBe("CA");

    expect(validateChipToken("maya@brand.com", "email")).toBeNull();
    expect(validateChipToken("not-an-email", "email")).toContain("valid email");
    expect(validateChipToken("TX", "state")).toBeNull();
    expect(validateChipToken("Texas", "state")).toContain("2-letter");
  });

  it("scores password strength accurately across empty, short, fair, good, and strong inputs", () => {
    expect(evaluatePasswordStrength("").score).toBe(0);
    expect(evaluatePasswordStrength("short").score).toBe(1);
    expect(evaluatePasswordStrength("abcdefgh").score).toBe(2);
    expect(evaluatePasswordStrength("Abcdefgh1").score).toBe(3);
    expect(evaluatePasswordStrength("Canyon$Spritz2026!").score).toBe(4);
  });

  it("resolves TideProgress threshold tones and builds deterministic SVG sparkline paths", () => {
    expect(resolveTideTone(42).status).toBe("healthy");
    expect(resolveTideTone(85).status).toBe("near_cap");
    expect(resolveTideTone(98).status).toBe("at_cap");

    expect(buildSparklinePath([10]).linePath).toBe("");
    const geom = buildSparklinePath([10, 20, 15, 30], 64, 22, 2);
    expect(geom.linePath).toMatch(/^M2,/);
    expect(geom.areaPath).toContain("Z");
    expect(geom.lastPoint).toEqual({ x: 62, y: 2 });
  });

  it("formats Ask Spark progressive stages and grounding summaries", () => {
    expect(askSparkPendingStage(400, false)).toBe("Checking program data…");
    expect(askSparkPendingStage(400, true)).toBe("Checking your program data…");
    expect(askSparkPendingStage(2400, true)).toContain("approved recaps");
    expect(askSparkPendingStage(5000, false)).toContain("grounded answer");

    expect(
      formatGroundingSummary({
        sourceCount: 3,
        thoughtSeconds: 1.4,
        hasChart: true,
      }),
    ).toBe("Grounded in 3 sources · chart verified · 1.4s");
  });

  it("defines CSS classes and reduced-motion fallbacks for all Wave 2 moments", () => {
    const css = readFileSync(join(here, "opsMotion.css"), "utf8");
    for (const cls of [
      ".spark-hub-indicator",
      ".spark-chip-pill",
      ".spark-odo-up",
      ".spark-odo-down",
      ".spark-stepper-pop",
      ".spark-plan-card",
      ".spark-tide-fill",
      ".spark-tide-crest",
      ".spark-strength-seg",
      ".spark-like-burst-ring",
      ".spark-like-pop",
      ".spark-kpi-skeleton-bar",
    ]) {
      expect(css).toContain(cls);
    }

    const reducedBlock = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    for (const cls of [
      ".spark-chip-pill",
      ".spark-odo-up",
      ".spark-tide-crest",
      ".spark-like-burst-ring",
      ".spark-hub-indicator",
      ".spark-plan-card",
      ".spark-tide-fill",
      ".spark-strength-seg",
      ".spark-kpi-skeleton-bar",
    ]) {
      expect(reducedBlock).toContain(cls);
    }
  });

  it("wires all 9 Wave 2 enhancements across their target Spark surfaces", () => {
    const read = (rel: string) => readFileSync(join(srcRoot, rel), "utf8");

    // 1. ChipInput
    expect(read("components/pages/reports/ExecutiveSnapshotCard.tsx")).toContain(
      "<ChipInput",
    );
    expect(read("components/pages/reports/RegionalAlertsCard.tsx")).toContain(
      "<ChipInput",
    );
    expect(read("recap/components/ShareRecapModal.tsx")).toContain(
      "<ChipInput",
    );
    expect(read("pilot/SavedViewsDigestBar.tsx")).toContain("<ChipInput");

    // 2. OdometerStepper
    expect(read("components/pages/checkin/QuickCountSteppers.tsx")).toContain(
      "<OdometerReadout",
    );

    // 3. PlanPicker & TideProgress
    const billing = read("pilot/PlansAndBillingPage.tsx");
    expect(billing).toContain("<PlanPickerCard");
    expect(billing).toContain("<TideProgress");
    expect(read("pilot/SelfServeOnboardingPage.tsx")).toContain(
      "<PlanPickerCard",
    );

    // 4. StrengthMeter
    expect(read("pilot/SelfServeOnboardingPage.tsx")).toContain(
      "<PasswordStrengthMeter",
    );
    expect(read("auth/components/RegisterForm.tsx")).toContain(
      "<PasswordStrengthMeter",
    );
    expect(read("auth/ResetPassword.tsx")).toContain("<PasswordStrengthMeter");

    // 5. LikeBurst
    expect(read("components/pages/photos/SparkPhotoGallery.tsx")).toContain(
      "<LikeBurst",
    );

    // 6. Sliding Hub Sub-Navigation
    expect(read("shared/SparkHubTabs.tsx")).toContain("spark-hub-indicator");

    // 7. Ask Spark Grounding Bar
    expect(read("components/ai/AskAiButton.tsx")).toContain(
      "<AskSparkEvidenceBar",
    );
    expect(read("components/ai/BrandChatPanel.tsx")).toContain(
      "<AskSparkEvidenceBar",
    );

    // 8. Active Filter Summary Strip
    expect(read("requests/MasterTracker.tsx")).toContain("<ActiveFilterStrip");
    expect(read("recap/SparkRecapsList.tsx")).toContain("<ActiveFilterStrip");

    // 9. Unified KPI Card Anatomy (Delta + Skeletons, no header sparkline clutter)
    expect(read("components/pages/reports/ExecutiveSnapshotCard.tsx")).toContain(
      "<KpiDeltaBadge",
    );
    expect(
      read("components/pages/reports/ExecutiveSnapshotCard.tsx"),
    ).not.toContain("<MiniSparkline");
    expect(read("components/pages/reports/SparkReports.tsx")).not.toContain(
      "<MiniSparkline",
    );
    expect(read("components/pages/reports/ShelfVoicePage.tsx")).not.toContain(
      "<MiniSparkline",
    );
    expect(read("components/pages/reports/SparkReports.tsx")).toContain(
      "<StudioKpiSkeleton",
    );
    expect(read("components/pages/reports/ShelfVoicePage.tsx")).toContain(
      "<StudioKpiSkeleton",
    );
  });
});
