/**
 * Targets for the "Nudge all overdue (24h+)" action on /recaps/missing.
 *
 * Reuses the same per-BA NudgeAmbassadorForRecapMutation — this module
 * only decides *who* to fire at: shifts overdue ≥24h, skipping anyone
 * nudged in the last 12 hours (cron or prior admin click).
 */

export const OVERDUE_HOURS_THRESHOLD = 24;
export const RECENT_NUDGE_SKIP_HOURS = 12;

export type OverdueNudgeBa = {
  ambassadorEventUuid: string;
  name: string;
  lastNudgedAt?: string | null;
};

export type OverdueNudgeEvent = {
  eventUuid: string;
  /** Relay GraphQL Int fields are `number | null | undefined`. */
  hoursOverdue: number | null | undefined;
  assignedAmbassadors: ReadonlyArray<OverdueNudgeBa>;
};

export type OverdueNudgeTarget = {
  eventUuid: string;
  ambassadorEventUuid: string;
  name: string;
};

/** True when lastNudgedAt is within the skip window (default 12h). */
export function wasNudgedRecently(
  lastNudgedAt: string | null | undefined,
  nowMs: number = Date.now(),
  skipHours: number = RECENT_NUDGE_SKIP_HOURS,
): boolean {
  if (!lastNudgedAt) return false;
  const ts = Date.parse(lastNudgedAt);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts < skipHours * 60 * 60 * 1000;
}

/**
 * Flatten overdue (≥24h) BA rows, skipping recently nudged ambassadors.
 * One target per AmbassadorEvent — same id the single-row Nudge button uses.
 */
export function overdueNudgeTargets(
  rows: ReadonlyArray<OverdueNudgeEvent>,
  nowMs: number = Date.now(),
): OverdueNudgeTarget[] {
  const out: OverdueNudgeTarget[] = [];
  for (const row of rows) {
    if (row.hoursOverdue == null || row.hoursOverdue < OVERDUE_HOURS_THRESHOLD) {
      continue;
    }
    for (const ba of row.assignedAmbassadors) {
      if (!ba.ambassadorEventUuid) continue;
      if (wasNudgedRecently(ba.lastNudgedAt, nowMs)) continue;
      out.push({
        eventUuid: row.eventUuid,
        ambassadorEventUuid: ba.ambassadorEventUuid,
        name: ba.name,
      });
    }
  }
  return out;
}

/** Short relative label for the last-nudged chip ("2h ago", "just now"). */
export function formatLastNudgedAt(
  lastNudgedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!lastNudgedAt) return null;
  const ts = Date.parse(lastNudgedAt);
  if (Number.isNaN(ts)) return null;
  const mins = Math.max(0, Math.floor((nowMs - ts) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
