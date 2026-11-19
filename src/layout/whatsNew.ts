/**
 * "What's new" — short, plain release notes shown from the account menu.
 * Newest first. Bump the first entry's `id` when adding one; the unread dot
 * clears once a person opens the list.
 */
export type WhatsNewEntry = { id: string; date: string; title: string; items: string[] };

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-11-19t",
    date: "November 19, 2026",
    title: "Time-sheet-only check-in links",
    items: [
      "A client's check-in link can now be a plain time clock. Workers enter their name and mobile number, Spark fills in their location from the phone, and they clock in and clock out. There's no recap step.",
      "If a worker turns location off, they type the address instead. These are event locations, so the link never asks for a store name.",
      "Nothing chases a recap for these shifts: no recap texts, and they never appear on Missing Recaps.",
      "The Timesheet page now shows each worker's phone, and a new Time sheet (per shift) download lists name, phone, date, location, clock in, clock out and hours for every confirmed shift.",
    ],
  },
  {
    id: "2026-11-19a",
    date: "November 19, 2026",
    title: "Walk-up links check the shift is today",
    items: [
      "When a BA's check-in would start a new walk-in event, the walk-up link now asks “Is your shift today?” first. If they tap No, it tells them to open the link when their shift starts, and nothing is created or clocked.",
      "Joining an event that's already on the tracker, filing a past-day recap and recap-only links don't ask.",
      "Short walk-in shifts, clocked in and out within 20 minutes, no longer get the “your recap isn't in yet” texts. Booked shifts still do.",
    ],
  },
  {
    id: "2026-11-18s",
    date: "November 18, 2026",
    title: "Walk-up recaps land under the right store",
    items: [
      "Walk-up check-ins now ask BAs for the store name on Retail Sampling shifts, so their recaps count under that store and state on your dashboard instead of No store recorded. Event activations still only ask for the venue.",
      "When a BA checks in at an address your team has worked before, Spark fills in the store and state from that earlier visit.",
    ],
  },
  {
    id: "2026-11-18v",
    date: "November 18, 2026",
    title: "Festivals show by venue",
    items: [
      "Consumers sampled by store now shows festivals and events by their venue name instead of No store recorded. Venues are marked (venue) so they are not mistaken for stores.",
    ],
  },
  {
    id: "2026-11-18b-2",
    date: "November 18, 2026",
    title: "Connect an AI app with Google",
    items: [
      "When you connect Claude, ChatGPT or another AI app to Spark, choose Continue with Google on the Spark page. Spark signs you in with Google, then brings you back to pick the brand.",
    ],
  },
  {
    id: "2026-11-18c",
    date: "November 18, 2026",
    title: "Search your field photos",
    items: [
      "The Photos page has a search box. Type what you want in plain words, like “best crowd photos at Kroger in Texas”, and Spark turns it into filters you can see and remove.",
      "One tap narrows to consumers engaging, product on the table, shelf displays or signage, and you can hide blurry or dark photos.",
      "Spark tags each photo once: what it shows, which of your products are in it, roughly how busy it was and the setting. It never identifies anyone.",
      "Brands see photos from their own approved recaps only, and receipts never appear. Staff can also include recaps waiting for approval and add photos to a recap deck.",
    ],
  },
  {
    id: "2026-11-17i",
    date: "November 17, 2026",
    title: "Launch a client: the new brand's products on the cloned form",
    items: [
      "When you launch a client from another brand's recap form, Products Sampled and any other product picker now list the new client's catalog, never the donor brand's products.",
      "The preview shows exactly which products each picker will offer and every label swap, including swaps inside answer choices. Choices like \"Full can\" are left alone.",
      "Launching without a catalog leaves those pickers empty and says so, instead of keeping the donor's products.",
    ],
  },
  {
    id: "2026-11-18b-1-2",
    date: "November 18, 2026",
    title: "Say your recap, and the form fills in",
    items: [
      "On the check-in recap, tap Record and talk through the shift. Spark fills in the whole form from what you said: counts, dropdowns, products, yes or no questions and notes.",
      "Recording now works on iPhone Safari too.",
      "Only empty boxes are filled. If you already typed an answer, it stays, and you can tap Replace to use what you said instead. Boxes filled by voice are marked so you can check them before you submit.",
      "Spark never guesses: anything you didn't mention stays blank. Recordings are turned into text and not kept.",
    ],
  },
  {
    id: "2026-11-18b-1-1",
    date: "November 18, 2026",
    title: "Hours check before payroll",
    items: [
      "Staff: the Payroll timesheet now checks each shift before you approve hours, and says how many need a look, such as \"7 of 212 shifts need a look\".",
      "It flags shifts worked past their booking, punches far from the store, shifts that overlap, recaps filed before the clock-out, auto-closed or hand-edited punches, and mileage above what GPS tracked. Each flag shows the facts and a suggested next step.",
      "Nothing is rejected for you. Mark a flag OK, reviewed and it stops asking unless the punches change. Turn on Needs a look to see only those BAs.",
    ],
  },
  {
    id: "2026-11-18r",
    date: "November 18, 2026",
    title: "Where to go next updates on its own",
    items: [
      "Store recommendations on your dashboard's Where to go next card now appear as soon as Spark works them out from approved recaps, instead of waiting for the Ignite team to review them.",
    ],
  },
  {
    id: "2026-11-18i",
    date: "November 18, 2026",
    title: "Insights uses your local date",
    items: [
      "Insights now asks for the right date range in the evening. Before, after about 5 PM Pacific it counted tomorrow as today, so the last 7, 30 or 90 days could start and end a day late.",
    ],
  },
  {
    id: "2026-11-17e-1",
    date: "November 17, 2026",
    title: "Clearer messages when Spark is busy",
    items: [
      "If you make a lot of requests in a short time, export too often or select too many items at once, Spark now says so in plain words and tells you to try again shortly, instead of showing an error page.",
      "Too many sign-in attempts shows a short wait message on the sign-in page.",
      "Long lists on Home, Upcoming, Recent submissions, My approvals, Alerts, Reports and the Account Map load in full for brand users.",
    ],
  },
  {
    id: "2026-11-18b-1",
    date: "November 18, 2026",
    title: "Ask AI is now a chat",
    items: [
      "On your Home page, Ask AI opens a chat about your own program: ask things like which stores converted best last month, which stores to go back to in December, or what shoppers are saying about price.",
      "Answers come only from your brand's data in Spark, with small source chips under each answer that open the page the numbers came from. If a figure can't be matched to your data, the answer isn't shown.",
      "It's read only and never changes anything. Start a new chat any time, and clear your chat history whenever you like.",
    ],
  },
  {
    id: "2026-11-18b",
    date: "November 18, 2026",
    title: "Product answers from brand documents and websites",
    items: [
      "Ambassadors: product questions on the check-in page are now also answered from the brand's uploaded documents and its own website, and each answer says where it came from, such as a product page or a sell sheet.",
      "Staff: on the BA product notes card under Walk-ups, Standing codes, add the brand's website, see every page and document Spark read, refresh them now, or exclude one. Your notes win when they disagree with the website.",
    ],
  },
  {
    id: "2026-11-18a-1",
    date: "November 18, 2026",
    title: "Where to go next, and alerts",
    items: [
      "Brand dashboards can show a Where to go next card: stores that converted well above your average and are worth a return visit, and stores to fix, such as no product on the shelf twice in 30 days or lots of sampling with few sales.",
      "An Alerts card gives short notices about last week, such as product missing at a store or conversion dropping against the 4 weeks before.",
      "Every number comes from approved recaps, visits with no product are left out of conversion, and the Ignite team reviews each one before it appears.",
      "Staff: review and publish them under Client summaries, Store insights.",
    ],
  },
  {
    id: "2026-11-17g-1",
    date: "November 17, 2026",
    title: "Campaign recap decks",
    items: [
      "Ignite can now build your end-of-program recap deck in Spark: headline numbers, where the program ran, what consumers said, the best photos from the field and suggested next steps.",
      "When Ignite shares a deck with you, it appears under Recap decks in your program report, ready to download as a PDF.",
      "Store visits where there was no product on hand are left out of the demo count and listed at the end of the deck. Totals still match your dashboard.",
    ],
  },
  {
    id: "2026-11-17h",
    date: "November 17, 2026",
    title: "Updated Terms, Privacy Policy and new legal pages",
    items: [
      "The Terms of Service are reorganized into parts for everyone, for brands, and for brand ambassadors, and the Privacy Policy now lists the services Spark uses and explains location, text messages and AI features.",
      "New pages: an Acceptable Use Policy and a Data Processing Summary for brands. Each legal page links to the others.",
    ],
  },
  {
    id: "2026-11-17g",
    date: "November 17, 2026",
    title: "Connect Claude or ChatGPT",
    items: [
      "Brands can now ask Claude or ChatGPT about their program with their own Spark login: results, recaps, stores, upcoming events and what's waiting on approval. Open AI connector in the sidebar for the link and steps.",
      "It reads your brand's data only, can't change anything, and never shares brand ambassadors' personal details. You can disconnect an app at any time from the same page.",
      "Updated Terms of Service: automated access to Spark is allowed only through this connection or another integration Ignite approves in writing.",
    ],
  },
  {
    id: "2026-11-17f-1",
    date: "November 17, 2026",
    title: "What consumers mention, month by month",
    items: [
      "Insights now shows which themes and other brands come up in consumer comments over the last six months, with a small column per month.",
      "Each theme says whether it is rising, falling or steady compared with the month before, with a comment as a shopper said it. Small changes are not called a trend.",
    ],
  },
  {
    id: "2026-11-18a",
    date: "November 18, 2026",
    title: "Product questions on the check-in page",
    items: [
      "Ambassadors: once you've checked in, ask a product question such as \"How much caffeine is in this?\" and get a short answer taken only from the brand's own notes. If the notes don't cover it, it says so — check with your lead.",
      "Staff: write each brand's BA product notes and see what ambassadors have been asking under Walk-ups, Standing codes.",
    ],
  },
  {
    id: "2026-11-17f",
    date: "November 17, 2026",
    title: "An easier-to-read state map",
    items: [
      "On Geographic performance, states with more activity are now a darker blue and states with none are plain gray, so the busiest state stands out instead of fading away.",
      "Each state with activity shows its number on the map, and a ranked list beside it gives every state's total and share.",
      "When a brand runs in only a few neighboring states, the map zooms to them. Choose Show all states to see the whole country.",
    ],
  },
  {
    id: "2026-11-17e",
    date: "November 17, 2026",
    title: "A simpler Upcoming page",
    items: [
      "Upcoming lists the next 7 days as a plain schedule: one list per day, with the time first, then the store and its address. Click any row to open it.",
      "Only events that still need something show a status, such as Pending.",
    ],
  },
  {
    id: "2026-11-17d",
    date: "November 17, 2026",
    title: "Spend needs a receipt photo",
    items: [
      "Ambassadors: if you enter product spend on a recap, add a photo of the receipt to the receipt group before you submit. The form tells you right away if it's missing.",
      "Staff editing a recap can still enter spend without a receipt.",
    ],
  },
  {
    id: "2026-11-17c",
    date: "November 17, 2026",
    title: "Move an event yourself",
    items: [
      "Need a different day or time? Open the event and choose Change date. Pick the new day, start and end time, and Ignite is told right away so they can confirm the team.",
      "Events that are cancelled, already started or already recapped can't be moved this way. Contact Ignite for those.",
      "If a request is already on the schedule, change its date from the event instead of the request.",
    ],
  },
  {
    id: "2026-11-17b",
    date: "November 17, 2026",
    title: "Fixes for people on more than one brand",
    items: [
      "If your login covers more than one brand, My Requests, Insights, Ask AI and event, request and job pages load for the brand you have selected instead of saying you are not a member or the item was not found.",
      "Answers such as \"over 200\", \"more than 200\" or \"at least 200\" now count as 200.",
    ],
  },
  {
    id: "2026-11-17",
    date: "November 17, 2026",
    title: "Numbers that agree",
    items: [
      "The campaign report, its share link and PDF, and the numbers at the top of Home count approved recaps only, the same as the rest of the page.",
      "Product given away as samples is no longer counted as sold.",
      "A number typed as 1,234 reads as 1,234 everywhere. Approximate answers such as ~30 or 50+ count as 30 and 50, and a range such as 20-30 counts as 20.",
      "Staff: Approve selected approves every selected recap, including ones the current filter hides, and says how many were approved and how many could not be.",
    ],
  },
  {
    id: "2026-11-16",
    date: "November 16, 2026",
    title: "Right day, full lists, fewer stray reminders",
    items: [
      "Today, Upcoming and the Calendar put each event on the day it happens at the store, wherever you are looking from.",
      "The Calendar and Upcoming show every event in the period instead of stopping at 100.",
      "Ambassadors no longer get shift reminders or a not-clocked-in nudge for a demo that was cancelled.",
      "A shift reminder email that fails to send is tried again on the next run, and is only marked sent once it goes out.",
      "Times in shift emails stay right after a daylight saving change.",
      "Staff: the Timesheet opens on the client you have selected, and clock-in and clock-out times are shown and edited in the store's time zone.",
      "Staff: Assign a BA searches every active ambassador by name.",
      "Staff: System Health loads again.",
    ],
  },
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
      "Worth a look no longer calls a state quiet, or a week a drop, while its recaps are still waiting for review.",
      "Staff: Worth a look says when a state has recaps waiting for review, with a link to them.",
      "The quote in the highlight of the month is credited to the approved recap it came from.",
      "Insights tiles and a few other screens no longer use emoji as icons.",
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
