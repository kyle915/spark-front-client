/**
 * "My shifts" on the public check-in page — the BA's own recent shifts with
 * worked hours and where each stands. Mirrors the payload of
 * POST /api/public/checkin/<code>/my-shifts (spark-api
 * ambassadors/checkin_history.py). No dollar amounts by design.
 */
export type ShiftStatus =
  | "pending_review"
  | "confirmed"
  | "hours_approved"
  | "paid";

export type HistoryShift = {
  eventDate: string | null;
  name: string;
  address: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  onTheClock: boolean;
  hours: number | null;
  status: ShiftStatus;
  paidAt: string | null;
  recapFiled: boolean;
  /** Staff dismissed the missing recap: none is owed for this shift. */
  recapDismissed?: boolean;
};

export type ShiftHistory = {
  shifts: HistoryShift[];
  totalHours: number;
  windowDays: number;
};

/** "3 hr 30 min" / "45 min" / "2 hr". Empty string when unknown. */
export function formatHours(hours: number | null | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) return "";
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export type StatusView = { label: string; detail: string; tone: "wait" | "ok" | "done" };

export function shiftStatusView(shift: HistoryShift): StatusView {
  if (shift.onTheClock) {
    return { label: "On the clock", detail: "Clock out when you finish.", tone: "wait" };
  }
  if (!shift.recapFiled && !shift.recapDismissed) {
    return {
      label: "Recap needed",
      detail: "File the recap so your hours can be reviewed.",
      tone: "wait",
    };
  }
  switch (shift.status) {
    case "paid": {
      const when = shift.paidAt ? new Date(shift.paidAt) : null;
      const on =
        when && !Number.isNaN(when.getTime())
          ? ` on ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : "";
      return { label: "Paid", detail: `Payment sent${on}.`, tone: "done" };
    }
    case "hours_approved":
      return {
        label: "Hours approved",
        detail: "Approved for payroll. Payment comes through Wingspan.",
        tone: "ok",
      };
    case "confirmed":
      return {
        label: "Confirmed",
        detail: "Ignite confirmed this shift. Hours are approved each pay period.",
        tone: "ok",
      };
    case "pending_review":
    default:
      return {
        label: "Waiting for review",
        detail: "Ignite reviews new shifts before they count toward pay.",
        tone: "wait",
      };
  }
}

/** Defensive parse — a bad payload yields an empty history, never a throw. */
export function parseShiftHistory(raw: unknown): ShiftHistory {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(obj.shifts) ? obj.shifts : [];
  const statuses: ShiftStatus[] = ["pending_review", "confirmed", "hours_approved", "paid"];
  const shifts: HistoryShift[] = list
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      eventDate: typeof s.eventDate === "string" ? s.eventDate : null,
      name: typeof s.name === "string" ? s.name : "",
      address: typeof s.address === "string" ? s.address : "",
      clockInAt: typeof s.clockInAt === "string" ? s.clockInAt : null,
      clockOutAt: typeof s.clockOutAt === "string" ? s.clockOutAt : null,
      onTheClock: s.onTheClock === true,
      hours: typeof s.hours === "number" ? s.hours : null,
      status: statuses.includes(s.status as ShiftStatus)
        ? (s.status as ShiftStatus)
        : "pending_review",
      paidAt: typeof s.paidAt === "string" ? s.paidAt : null,
      recapFiled: s.recapFiled === true,
      recapDismissed: s.recapDismissed === true,
    }));
  return {
    shifts,
    totalHours: typeof obj.totalHours === "number" ? obj.totalHours : 0,
    windowDays: typeof obj.windowDays === "number" ? obj.windowDays : 60,
  };
}
