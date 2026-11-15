/**
 * A secondary action (Share, Edit recap, Archive, Delete). Shown inline on
 * wide screens and inside the "More" menu on narrow ones.
 */
export type RecapStickyAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** `danger` = destructive (Delete); `active` = a toggle that is on. */
  tone?: "default" | "danger" | "active";
  /**
   * Only offered in the "More" menu, and only on phones, where the bar has
   * room for a single primary button. The matching bar button is wrapped in
   * `recap-sticky-ops-from-sm` by the caller.
   */
  phoneOnly?: boolean;
};

/**
 * Wide screens: the destructive action leads the inline group, so it never
 * sits beside Approve at the far end of the bar.
 */
export const orderInlineActions = (
  actions: RecapStickyAction[],
): RecapStickyAction[] => {
  const bar = actions.filter((a) => !a.phoneOnly);
  return [
    ...bar.filter((a) => a.tone === "danger"),
    ...bar.filter((a) => a.tone !== "danger"),
  ];
};

/** More menu: the destructive action goes last, under a divider. */
export const orderMenuActions = (
  actions: RecapStickyAction[],
): RecapStickyAction[] => [
  ...actions.filter((a) => a.tone !== "danger"),
  ...actions.filter((a) => a.tone === "danger"),
];
