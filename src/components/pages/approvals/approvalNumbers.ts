/**
 * The headline numbers shown beside a recap's photo in the sign-off queue,
 * so a client can judge a recap without opening it. Only numbers the recap
 * actually reported are shown — a missing value is omitted, never "0".
 */
export type ApprovalNumbers = {
  sampled?: number | null;
  sold?: number | null;
  engaged?: number | null;
};

const fmt = (n: number): string => n.toLocaleString("en-US");

export const approvalNumberParts = (
  n: ApprovalNumbers,
): { label: string; value: string }[] => {
  const out: { label: string; value: string }[] = [];
  const add = (label: string, v: number | null | undefined) => {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out.push({ label, value: fmt(v) });
    }
  };
  add("sampled", n.sampled);
  add("sold", n.sold);
  // Engagements only when there is no sampling figure — otherwise it reads
  // as a second, competing reach number.
  if (!out.some((p) => p.label === "sampled")) add("engaged", n.engaged);
  return out;
};
