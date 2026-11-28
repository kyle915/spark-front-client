import type { CheckinStep } from "./checkinSteps";
import { StepTrack } from "@/motion/ProgressMoments";

/** Compact progress row for the check-in page. Purely informational. */
export const CheckinStepBar: React.FC<{ steps: CheckinStep[]; accent: string }> = ({
  steps,
  accent,
}) => (
  <StepTrack steps={steps} accent={accent} ariaLabel="Check-in progress" />
);

export default CheckinStepBar;
