import { formatDate, formatLocalDateTime } from "@/utils";

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
    ? `${formatDate(approvedAt)} ${formatLocalDateTime(approvedAt)}`.trim()
    : null;
  if (who && when) return `Approved by ${who} · ${when}`;
  if (who) return `Approved by ${who}`;
  if (when) return `Approved ${when}`;
  return null;
}
