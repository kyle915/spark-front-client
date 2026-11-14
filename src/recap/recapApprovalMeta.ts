import { formatLocalDateTime } from "@/utils";
import { formatInstantDate } from "@/utils/formatInstantDate";

export type RecapApprover = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export function recapApproverName(
  approver: RecapApprover | null | undefined,
): string | null {
  if (!approver) return null;
  const name = [approver.firstName, approver.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || approver.email || null;
}

export function recapApprovalMeta(
  approved: boolean,
  approver: RecapApprover | null | undefined,
  approvedAt: string | null | undefined,
): string | null {
  if (!approved) return null;
  const who = recapApproverName(approver);
  const when = approvedAt
    ? // Both halves in the viewer's zone. The date used to be sliced from
      // the UTC string while the time was converted, so an evening approval
      // read as tomorrow's date beside today's time.
      `${formatInstantDate(approvedAt)} ${formatLocalDateTime(approvedAt)}`.trim()
    : null;
  if (who && when) return `Approved by ${who} · ${when}`;
  if (who) return `Approved by ${who}`;
  if (when) return `Approved ${when}`;
  return null;
}
