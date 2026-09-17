/**
 * Leadership health for an Activation Plan pipeline.
 * Uses only trusted counts: planned / staffed / executed / verified.
 */

export type PlanPipeline = {
  planned: number;
  approved: number;
  staffed: number;
  executed: number;
  verified: number;
};

export type PlanHealthKind =
  | "empty"
  | "on_track"
  | "needs_staffing"
  | "needs_recaps"
  | "done";

export type PlanHealth = {
  kind: PlanHealthKind;
  label: string;
  color: string;
};

export function planHealth(pipeline: PlanPipeline): PlanHealth {
  const { planned, staffed, executed, verified } = pipeline;
  if (planned <= 0) {
    return {
      kind: "empty",
      label: "No requests",
      color: "rgba(255,255,255,0.45)",
    };
  }
  if (verified >= planned && planned > 0) {
    return {
      kind: "done",
      label: "Complete",
      color: "var(--spark-lime)",
    };
  }
  const staffGap = planned - staffed;
  const recapGap = staffed - executed;
  if (staffGap > planned * 0.35 || (staffed === 0 && planned > 0)) {
    return {
      kind: "needs_staffing",
      label: "Needs staffing",
      color: "var(--spark-orange)",
    };
  }
  if (recapGap > 0 && executed < staffed * 0.7) {
    return {
      kind: "needs_recaps",
      label: "Needs recaps",
      color: "var(--spark-orange)",
    };
  }
  return {
    kind: "on_track",
    label: "On track",
    color: "var(--spark-lime)",
  };
}

/** Execution rate: verified / planned (0–1). */
export function planVerifiedRate(pipeline: PlanPipeline): number {
  if (pipeline.planned <= 0) return 0;
  return Math.min(1, pipeline.verified / pipeline.planned);
}

export function planStaffedRate(pipeline: PlanPipeline): number {
  if (pipeline.planned <= 0) return 0;
  return Math.min(1, pipeline.staffed / pipeline.planned);
}

export type PlanWindowKind = "upcoming" | "active" | "past" | "undated";

export function planWindowKind(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today = new Date(),
): PlanWindowKind {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(`${startDate.slice(0, 10)}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate.slice(0, 10)}T00:00:00`) : null;
  if (!start && !end) return "undated";
  if (end && end < t) return "past";
  if (start && start > t) return "upcoming";
  return "active";
}

export function formatPlanWindow(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  if (!startDate && !endDate) return "No dates set";
  const fmt = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  if (startDate && endDate) return `${fmt(startDate)} → ${fmt(endDate)}`;
  if (startDate) return `From ${fmt(startDate)}`;
  return `Through ${fmt(endDate!)}`;
}
