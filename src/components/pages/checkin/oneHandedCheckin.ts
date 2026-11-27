export function stepNumericInput(
  current: string | undefined,
  delta: number,
): string {
  const cleaned = (current ?? "").trim();
  const parsed = cleaned === "" ? 0 : Number.parseInt(cleaned, 10);
  const base = Number.isFinite(parsed) ? parsed : 0;
  const next = Math.max(0, base + delta);
  return String(next);
}

const NON_STEPPER_NAME_RE =
  /\b(price|cost|spend|amount|dollar|rate|mile|miles|mileage|zip|postal|phone|year|percent|%)\b/i;

export function wantsQuickStepper(
  fieldName: string,
  isNumberField: boolean,
): boolean {
  if (!isNumberField) return false;
  if (NON_STEPPER_NAME_RE.test(fieldName)) return false;
  return true;
}

export function computeCompletionSummary(input: {
  totalCheckpoints: number;
  remainingItems: number;
}): {
  completed: number;
  total: number;
  pct: number;
  label: string;
} {
  const total = Math.max(1, input.totalCheckpoints, input.remainingItems);
  const remaining = Math.max(0, Math.min(total, input.remainingItems));
  const completed = total - remaining;
  const pct = remaining === 0 ? 100 : Math.round((completed / total) * 100);
  const label =
    remaining === 0
      ? "100% complete · Ready to submit"
      : `${pct}% complete · ${remaining} item${remaining === 1 ? "" : "s"} left`;
  return { completed, total, pct, label };
}

export function slotActionLabel(bucketName: string): string {
  const lower = bucketName.trim().toLowerCase();
  if (/\b(receipt|expense|spend)\b/.test(lower)) return "+ Receipt";
  if (/\b(setup|table|display|shelf)\b/.test(lower)) return "+ Setup";
  if (/\b(consumer|sampling|action|crowd|engagement)\b/.test(lower)) {
    return "+ Sampling Action";
  }
  const short = bucketName.trim().slice(0, 22);
  return `+ ${short || "Photo"}`;
}

export interface QuickPhotoSlotSpec {
  key: string;
  addLabel: string;
  doneLabel: string;
}

export const DEFAULT_QUICK_PHOTO_SLOTS: readonly QuickPhotoSlotSpec[] = [
  { key: "setup", addLabel: "+ Setup", doneLabel: "Setup" },
  { key: "action", addLabel: "+ Sampling Action", doneLabel: "Sampling Action" },
  { key: "receipt", addLabel: "+ Receipt", doneLabel: "Receipt" },
];
