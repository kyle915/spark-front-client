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
      "Missing recaps can be dismissed with a reason, and restored. A dismissed one leaves the list, the counts and the reminders.",
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
      "Reports and the dashboard group what consumers said into themes: what people liked, why they passed and what they asked, each with a count of recaps and a comment as written.",
      "The weekly summary on the dashboard is now a short write-up of last week from approved recaps, reviewed by the Ignite team before it appears.",
      "The weekly chart shows the last 12 completed weeks, so it no longer dips for a week that is still being approved.",
      "More detail on the dashboard shows consumers sampled per event.",
      "Staff: Weekly summaries (under Outputs) drafts each client's week to review, edit and copy. Nothing is sent from it.",
      "The recap page's action bar stays on one row on small screens, with share, edit, archive and delete under More.",
      "The check-in recap form points out numbers that do not add up before you submit. You can fix them or submit as is.",
      "Staffing Board: type a question such as who has worked a store in a city and is free on a day, and get a list of ambassadors who have clocked in there. The filters it used are shown, and you can change them.",
      "Staff: Weekly summaries is now Client summaries, and also drafts an email for each client's month to review, edit and copy. Nothing is sent from it.",
      "Under the dashboard numbers, a sentence or two says what changed against the period before and where the change came from. It stays quiet when there are too few approved recaps to compare.",
      "The dashboard lists up to four things worth a look, such as a store converting far above or below average or a state with no recent recaps, each with its numbers and a link to the recaps behind it.",
      "Each consumers and samples chart has an Ask about this chart link. The answer uses that chart's figures only.",
      "Account map: staff see a ranked list of where to sample next, with the reason for each store.",
      "Photos and the program report open on the best photos from each recap. All photos is one click away.",
      "On a recap, staff can pin or unpin which photos count as its best.",
      "Staff can draft a client recap for any dates: headline numbers, best photos and a short summary to edit, then download as a PDF.",
      "Reports and More detail on the dashboard list the other brands people mentioned in their comments, how many recaps named each, whether people preferred yours or theirs, and a comment as written.",
      "What sells where shows, for each state, the product with the most units sold, the most samples handed out and the one people spoke best of, each with the recaps it rests on. A state without enough recaps says Not enough data yet.",
      "A recap form worded differently from Spark's standard numbers can now be matched to them by our team, so the dashboard shows the number instead of a dash.",
      "When a recap is held for review, the reviewer sees one line saying why and what to check first.",
      "A store typed in different ways (HEB, H-E-B) can be combined, so reports count it once.",
      "Requests sent by email or in a sheet can be read into the request form by Ignite staff, who check each one before it is submitted.",
      "The check-in recap form has Fill from photo: take a photo of your tally sheet and the counts are read for you. Each number shows next to its box to accept or ignore, and nothing is filled in until you do.",
      "Reports and the dashboard have an On shelf summary from shelf photos on approved retail recaps: how often the product was on the shelf, how often a price tag was visible, and the stores where it was not found.",
      "Staff: a retail recap shows what each shelf photo shows (product on shelf, facings, price tag, gap) next to the photo, and you can correct it.",
      "Recaps and the request list have a search box: type what you are looking for, such as Texas Kroger events in October with conversion under 10%. The filters it used are shown, and you can change them. Anything it could not filter on is listed.",
      "Each store has its own page: every visit, totals from approved recaps, products, what consumers said there and photos. Open it from a pin on the account map, from the store chart on Reports, or from the retailer on a recap.",
      "The dashboard and Reports show a highlight for the month: the store with the best conversion, a comment from a consumer and a photo, with links to the store and the recap. It is left out when a month has too few approved recaps.",
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
