import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HoldToConfirmButton,
  SwipeToConfirm,
} from "./ConfirmGestures";
import {
  SWIPE_COMMIT_THRESHOLD,
  swipeProgressFromDelta,
} from "./confirmGestureMath";
import { CodeShakeBox, CopyMorphButton } from "./CopyMorphButton";
import {
  DownloadRingButton,
  PaperPlaneSendButton,
} from "./FeedbackActionButton";
import { BellToggle, InkSwitch } from "./InkSwitch";
import { LeafTabs } from "./LeafTabs";
import { StepTrack, StrokeCheckBadge } from "./ProgressMoments";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

describe("UI Moments primitives (Relay-free)", () => {
  it("exports all six UI Moments primitives cleanly", () => {
    expect(typeof InkSwitch).toBe("function");
    expect(typeof BellToggle).toBe("function");
    expect(typeof DownloadRingButton).toBe("function");
    expect(typeof PaperPlaneSendButton).toBe("function");
    expect(typeof CopyMorphButton).toBe("function");
    expect(typeof CodeShakeBox).toBe("function");
    expect(typeof HoldToConfirmButton).toBe("function");
    expect(typeof SwipeToConfirm).toBe("function");
    expect(typeof StrokeCheckBadge).toBe("function");
    expect(typeof StepTrack).toBe("function");
    expect(typeof LeafTabs).toBe("function");
  });

  it("clamps SwipeToConfirm progress cleanly across bounds and commit threshold", () => {
    expect(swipeProgressFromDelta(0, 200)).toBe(0);
    expect(swipeProgressFromDelta(-40, 200)).toBe(0);
    expect(swipeProgressFromDelta(100, 200)).toBe(0.5);
    expect(swipeProgressFromDelta(260, 200)).toBe(1);
    expect(swipeProgressFromDelta(50, 0)).toBe(0);
    expect(swipeProgressFromDelta(50, -10)).toBe(0);

    expect(SWIPE_COMMIT_THRESHOLD).toBeGreaterThanOrEqual(0.75);
    expect(SWIPE_COMMIT_THRESHOLD).toBeLessThanOrEqual(0.9);
    expect(swipeProgressFromDelta(163, 200)).toBeLessThan(SWIPE_COMMIT_THRESHOLD);
    expect(swipeProgressFromDelta(164, 200)).toBeGreaterThanOrEqual(
      SWIPE_COMMIT_THRESHOLD,
    );
  });

  it("defines CSS classes and prefers-reduced-motion fallbacks for every moment", () => {
    const css = readFileSync(join(here, "opsMotion.css"), "utf8");
    const requiredClasses = [
      ".spark-ink-switch",
      ".spark-ink-switch-thumb",
      ".spark-bell-ring",
      ".spark-plane-launching",
      ".spark-download-ring-arc",
      ".spark-copy-pop",
      ".spark-code-shake",
      ".spark-hold-btn",
      ".spark-hold-fill",
      ".spark-swipe-track",
      ".spark-swipe-thumb",
      ".spark-stroke-check-path",
      ".spark-step-connector-fill",
      ".spark-leaf-tabs",
      ".spark-leaf-indicator",
    ];
    for (const cls of requiredClasses) {
      expect(css).toContain(cls);
    }

    const reducedIdx = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(reducedIdx).toBeGreaterThan(-1);
    const reducedBlock = css.slice(reducedIdx);
    for (const cls of [
      ".spark-bell-ring",
      ".spark-plane-launching",
      ".spark-download-ring-arc",
      ".spark-copy-pop",
      ".spark-code-shake",
      ".spark-stroke-check-path",
      ".spark-ink-switch",
      ".spark-step-connector-fill",
      ".spark-leaf-indicator",
    ]) {
      expect(reducedBlock).toContain(cls);
    }
    expect(css).toContain('[data-spark-mode="light"] .spark-leaf-indicator');
  });

  it("wires all six UI Moments across their target Spark surfaces", () => {
    const read = (rel: string) => readFileSync(join(srcRoot, rel), "utf8");

    // 1. Ink Switch & Bell Toggle
    expect(read("components/pages/reports/ExecutiveSnapshotCard.tsx")).toContain(
      "<InkSwitch",
    );
    const alerts = read("components/pages/reports/RegionalAlertsCard.tsx");
    expect(alerts).toContain("<InkSwitch");
    expect(alerts).toContain("<BellToggle");

    // 2. Download Ring & Paper Plane Send
    expect(read("components/pages/reports/ExecutiveSnapshotCard.tsx")).toContain(
      "<DownloadRingButton",
    );
    expect(read("components/pages/reports/ExecutiveSnapshotCard.tsx")).toContain(
      "<PaperPlaneSendButton",
    );
    expect(read("recap/RecapCustomView.tsx")).toContain("<DownloadRingButton");
    expect(read("recap/SparkRecapView.tsx")).toContain("<DownloadRingButton");
    expect(read("recap/components/ShareRecapModal.tsx")).toContain(
      "<PaperPlaneSendButton",
    );
    expect(read("components/ai/AskAiButton.tsx")).toContain(
      "<PaperPlaneSendButton",
    );
    expect(read("components/ai/BrandChatPanel.tsx")).toContain(
      "<PaperPlaneSendButton",
    );

    // 3. Copy Morph & Code Shake
    expect(read("components/ai/AskAiButton.tsx")).toContain("<CopyMorphButton");
    expect(read("components/ai/BrandChatPanel.tsx")).toContain("<CopyMorphButton");
    expect(read("recap/components/ShareRecapModal.tsx")).toContain(
      "<CopyMorphButton",
    );
    expect(read("requests/WalkupCodePanel.tsx")).toContain("<CopyMorphButton");
    expect(read("components/pages/checkin/IdentifyStep.tsx")).toContain(
      "<CodeShakeBox",
    );
    expect(read("requests/CancelDemoDialog.tsx")).toContain("<CodeShakeBox");

    // 4. Hold to Confirm & Swipe to Confirm
    expect(read("shared/SparkConfirm.tsx")).toContain("<HoldToConfirmButton");
    expect(read("requests/DeleteRequestModal.tsx")).toContain(
      "<HoldToConfirmButton",
    );
    expect(read("requests/CancelDemoDialog.tsx")).toContain(
      "<HoldToConfirmButton",
    );
    expect(read("components/pages/checkin/SparkCheckin.tsx")).toContain(
      "<SwipeToConfirm",
    );

    // 5. Stroke Checklist & Step Track
    expect(read("components/pages/checkin/CheckinStepBar.tsx")).toContain(
      "<StepTrack",
    );
    expect(read("components/pages/checkin/RecapCompleteness.tsx")).toContain(
      "<StrokeCheckBadge",
    );
    const onboarding = read("pilot/SelfServeOnboardingPage.tsx");
    expect(onboarding).toContain("<StepTrack");
    expect(onboarding).toContain("<StrokeCheckBadge");

    // 6. Leaf Tabs
    expect(read("components/pages/approvals/SparkApprovals.tsx")).toContain(
      "<LeafTabs",
    );
    expect(read("recap/SparkRecapsList.tsx")).toContain("<LeafTabs");
    expect(read("requests/MasterTracker.tsx")).toContain("<LeafTabs");
  });
});
