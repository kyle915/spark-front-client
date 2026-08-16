export type ConfirmTone = "default" | "danger";

export function confirmActionClass(tone: ConfirmTone): string {
  return tone === "danger"
    ? "spark-overlay-action spark-overlay-action-danger"
    : "spark-overlay-action spark-overlay-action-primary";
}
