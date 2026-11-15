/**
 * "What's new" — short, plain release notes shown from the account menu.
 * Newest first. Bump the first entry's `id` when adding one; the unread dot
 * clears once a person opens the list.
 */
export type WhatsNewEntry = { id: string; date: string; title: string; items: string[] };

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-11-15",
    date: "November 15, 2026",
    title: "Maps, charts and a simpler sign-in",
    items: [
      "Sign-in is one short form with a Google button. The pages for resetting a password match it.",
      "Today has a map with a pin for every event, coloured by where the shift stands. Click a pin for the address and directions.",
      "Dashboards chart consumers sampled per week. Reports break the same count down by store, state and product, and the charts add up to the number at the top.",
      "Purchase intent now reads as a share of the people who were asked.",
      "Charts across Spark share one plainer style, in light and dark.",
      "A recap with no store comes with a suggested store, which staff can accept while approving it.",
      "Menu counts are small steady badges instead of flashing dots.",
      "Ambassadors get a text before a shift, and a reminder when a recap is still missing.",
      "Someone who clocks in after the scheduled end is no longer clocked out right away.",
      "Account map: one pin per store instead of one per chain, with pins that group as you zoom out and a search by store, city or address.",
      "An uploaded account list is saved for the whole team, not only in the browser that uploaded it.",
      "Maps use a quieter style, so pins stand out.",
      "Answers from Ask AI for clients are built from approved recaps only.",
      "An email that fails to send is tried again instead of being dropped.",
      "Opening a recap, request or event from an email switches Spark to that record's client, and tells you it did.",
      "The recap page's action bar stays on one row on small screens, with share, edit, archive and delete under More.",
    ],
  },
  {
    id: "2026-11-11",
    date: "November 11, 2026",
    title: "Your emails, your call",
    items: [
      "Spark now opens in light mode. Prefer dark? Open the menu behind your initial and choose Appearance.",
      "One main button per screen: selected tabs are now quiet, and row buttons are outlined.",
      "Email preferences (in the menu behind your initial): turn off request updates, recap-review alerts, digests, mentions or ambassador-application emails for yourself.",
      "Requests and events show an activity history: who created, approved or edited, and when.",
      "A setup checklist appears on the dashboard for clients that haven't launched yet.",
      "Master Tracker: select rows to approve or assign an ambassador in bulk.",
      "Program report: field photos, a map of where you activated, and a monthly email you can subscribe to.",
    ],
  },
  {
    id: "2026-11-10",
    date: "November 10, 2026",
    title: "Easier to read, easier to get around",
    items: [
      "The top bar fits on one row on phones. Admin/Client preview and Log out moved into the menu behind your initial.",
      "Pages and browser tabs are named for where you are (for example \"Recaps\").",
      "Staffing Board: filter by client, search a store, or show unstaffed shifts only.",
      "Reports: pick 30 days, 90 days, 6 months, year to date or your own dates.",
      "Clients can sign off several recaps at once from My Approvals.",
      "Client views show ambassadors as first name and last initial, with no GPS pins.",
      "Walk-up ambassadors show with their phone number instead of a placeholder email.",
      "Timesheet \"Approve all\" asks before it approves.",
      "Text is larger and higher-contrast, and captions use the regular typeface.",
    ],
  },
];

const KEY = "@spark.whatsNew.seen";

export function hasUnseenWhatsNew(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== WHATS_NEW[0]?.id;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(): void {
  try {
    if (WHATS_NEW[0]) window.localStorage.setItem(KEY, WHATS_NEW[0].id);
  } catch {
    /* storage unavailable */
  }
}

/** Shortcuts that work today, grouped by where they apply. */
export const SHORTCUTS: { scope: string; keys: [string, string][] }[] = [
  {
    scope: "Anywhere",
    keys: [
      ["⌘K / Ctrl K", "Jump to a page, recap, request or ambassador"],
      ["Esc", "Close a menu or dialog"],
    ],
  },
  {
    scope: "Recaps",
    keys: [
      ["/", "Focus search"],
      ["n", "Review next"],
      ["j / k", "Move down / up"],
      ["Enter", "Open the focused recap"],
      ["?", "Recaps key help"],
    ],
  },
];

/** Where "Send feedback" goes (product owners). */
export const FEEDBACK_RECIPIENTS = [
  "kyle@igniteproductions.co",
  "nevena@igniteproductions.co",
];

/**
 * mailto: link for product feedback, pre-filled with the page the person was
 * on so a report is actionable without a back-and-forth.
 */
export function feedbackMailto(opts: {
  pageTitle: string;
  pageUrl: string;
  clientName?: string;
}): string {
  const subject = `Spark feedback — ${opts.pageTitle || "Spark"}`;
  const body = [
    "What happened, or what would make this better?",
    "",
    "",
    "—",
    `Page: ${opts.pageTitle}`,
    `Link: ${opts.pageUrl}`,
    opts.clientName ? `Client: ${opts.clientName}` : "",
  ]
    .filter((line, i) => i < 4 || line)
    .join("\n");
  return `mailto:${FEEDBACK_RECIPIENTS.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
