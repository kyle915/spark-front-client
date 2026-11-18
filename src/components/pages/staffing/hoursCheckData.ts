import type { PayrollHoursCheckQuery as CheckQueryType } from "@api/queries/__generated__/PayrollHoursCheckQuery.graphql";

export type HoursReport = CheckQueryType["response"]["payrollHoursCheck"];
export type HoursShift = HoursReport["shifts"][number];
export type HoursFlag = HoursShift["flags"][number];

/** Hours-check shifts grouped by BA, for the timesheet rows. */
export function shiftsByAmbassador(report: HoursReport | null | undefined) {
  const out = new Map<string, HoursShift[]>();
  for (const s of report?.shifts ?? []) {
    const list = out.get(s.ambassadorUuid) ?? [];
    list.push(s);
    out.set(s.ambassadorUuid, list);
  }
  return out;
}
