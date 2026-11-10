import type { ReactNode } from "react";

/**
 * One place that decides what colour a status is.
 *
 * Spark's status language is deliberately restrained — three tones, not a
 * rainbow:
 *   attention → orange   (needs a person: review, overdue, no rate)
 *   done      → off-white (approved, confirmed, paid)
 *   progress  → sky      (in flight: pending, scheduled, queued)
 *   neutral   → muted    (informational, archived)
 *
 * Use this instead of hand-styling a pill so the same status always looks
 * the same on every screen.
 */
export type StatusTone = "attention" | "done" | "progress" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  attention: "chip-orange",
  done: "chip-lime",
  progress: "chip-sky",
  neutral: "chip-muted",
};

const STATUS_TONE: Record<string, StatusTone> = {
  // review / approval
  needs_review: "attention",
  review: "attention",
  overdue: "attention",
  declined: "attention",
  flagged: "attention",
  approved: "done",
  confirmed: "done",
  paid: "done",
  done: "done",
  shared: "done",
  // in flight
  pending: "progress",
  queue: "progress",
  scheduled: "progress",
  hours_approved: "progress",
  // informational
  archived: "neutral",
  draft: "neutral",
  not_filed: "neutral",
};

export function statusTone(status: string | null | undefined): StatusTone {
  const key = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_TONE[key] ?? "neutral";
}

export function StatusChip({
  status,
  tone,
  children,
  small = false,
  title,
}: {
  /** Status key (e.g. "needs_review", "paid"); used to pick the tone. */
  status?: string | null;
  /** Explicit tone; overrides the lookup. */
  tone?: StatusTone;
  children: ReactNode;
  small?: boolean;
  title?: string;
}) {
  const resolved = tone ?? statusTone(status);
  return (
    <span
      className={`chip ${TONE_CLASS[resolved]}${small ? " chip-sm" : ""}`}
      title={title}
    >
      {children}
    </span>
  );
}

export default StatusChip;
