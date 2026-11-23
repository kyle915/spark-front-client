/**
 * "What's new" — short, plain release notes shown from the account menu.
 * Newest first. Bump the first entry's `id` when adding one; the unread dot
 * clears once a person opens the list.
 */
export type WhatsNewEntry = {
  id: string;
  date: string;
  title: string;
  items: string[];
  /** Ignite staff only: hidden in client view (brand users read this panel too). */
  staffOnly?: boolean;
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-11-23aa",
    date: "November 23, 2026",
    title: "Standing Check-In Studio on Walk-ups",
    staffOnly: true,
    items: [
      "On Walk-ups → Standing codes, staff can edit programs, photo buckets, BA PDF/link materials, and location mode (store address vs market picker) without a setup workflow ticket.",
      "The live standing check-in code stays immutable once issued — Studio never remints or rotates it. Issue a code only when the brand has none yet.",
      "All standing codes across brands still list under the studio for copy/QR, including client-team twin links.",
    ],
  },
  {
    id: "2026-11-23z",
    date: "November 23, 2026",
    title: "Why a recap Needs Eyes, and confirm CSV guesses",
    staffOnly: true,
    items: [
      "On Needs review, each Needs Eyes recap now has one short line saying why. Clean rows stay quiet, and the Clean / Needs Eyes rules are unchanged. The line never approves or rejects a recap.",
      "Provider CSV import shows its column guesses and why. A header Spark only suggests stays off until you check it. Commit still waits for you.",
      "When a row matches more than one store, Spark lists those stores and why it will not pick one. Nothing is linked until you choose.",
    ],
  },
  {
    id: "2026-11-23y",
    date: "November 23, 2026",
    title: "One-click Send on Client summaries",
    staffOnly: true,
    items: [
      "On Client summaries, use Send to email a branded weekly or monthly write-up to brand recipients (prefills recap contacts + client users) instead of a blank mailto.",
      "Spark records who sent it and when, so you can see Sent on the row and Send again if needed.",
    ],
  },
  {
    id: "2026-11-23v",
    date: "November 23, 2026",
    title: "Buyer deck sell-story captions + finance dispute notes",
    items: [
      "Buyer Pitch Decks now draft leave-behind photo captions and a short sell-story from scored photos, consumer mentions, and shelf facts — no new vision models; dollars and lift stay from the deck snapshot.",
      "On Finance Queue, each exception includes a copy-ready dispute pack (grounded one-liner, OCR/ledger facts, and suggested next step) so reviewers can paste into clarifications without rewriting “why unmatched.”",
    ],
  },
  {
    id: "2026-11-23o",
    date: "November 23, 2026",
    title: "1-click attach walk-up recaps on Missing Recaps",
    staffOnly: true,
    items: [
      "On Missing Recaps, when a BA already filed a walk-up that uniquely matches a Tracker RECAP DUE row (same day and place), Spark shows a Walk-up match chip with Attach walk-up recap.",
      "Attach all safe matches links every high-confidence orphan in one tap — the same rules as the nightly link job, so ghost DUE rows clear without CLI.",
      "Walk-up filings still auto-link on submit when the match is unique; the Missing Recaps chips cover historical orphans that stayed unlinked.",
    ],
  },
  {
    id: "2026-11-23n",
    date: "November 23, 2026",
    title: "Nudge all overdue missing recaps in one click",
    staffOnly: true,
    items: [
      "On Missing Recaps, Nudge all overdue (24h+) pushes every BA on shifts overdue a day or more — same push as the per-row Nudge button, skipping anyone nudged in the last 12 hours.",
      "Each BA row shows when they were last nudged (cron or admin) so weekend clear-outs don't double-ping.",
    ],
  },
  {
    id: "2026-11-23w",
    date: "November 23, 2026",
    title: "Recap fields fill the page (photos stay right)",
    items: [
      "On recap detail and shared /r links, Shift Overview, Brand Results, Brand Feedback and Follow-up sit in a two-column grid that uses the full width — no more skinny left stack with empty space.",
      "Photos stay on the right on wide screens; stats still sit under the title.",
    ],
  },
  {
    id: "2026-11-23t",
    date: "November 23, 2026",
    title: "Email links open the right brand, plus check-in prep polish",
    items: [
      "Portal and digest emails now deep-link with ?t= so multi-workspace users land on the brand the email is about instead of whichever client was last selected.",
      "Store Prep Kit on walk-up check-in keeps stock-risk above the fold and opens automatically when risk is watch or high, with a clearer Open prep control.",
      "Clean triage and Ask AI kickers use high-contrast deep forest / dark ink on light surfaces — no neon lime as text on paper.",
    ],
  },
  {
    id: "2026-11-23k",
    date: "November 23, 2026",
    title: "Recap stats sit under the title",
    items: [
      "On a recap detail (and shared /r links), Engagements, Sold, Conv and Photos now sit directly under the title — before the photo wall and long field list — so the numbers are first.",
      "The wider desktop layout stays; on phones the four tiles stay a readable 2×2.",
    ],
  },
  {
    id: "2026-11-23q",
    date: "November 23, 2026",
    title: "Ask AI answers shelf, cost, POS and competitors",
    items: [
      "Ask AI (BrandChat) and the Claude / ChatGPT AI connector can now pull on-shelf compliance, brand demo cost rollups, retailer POS velocity and ROI, and competitor brands named in recap comments — same Spark figures as Reports, Demo Costs and Retailer POS.",
      "Numbers still come from Spark readers only; the model plans which tool to call and never invents KPIs. Outside field agencies cannot see consolidated cost or POS through these tools.",
    ],
  },
  {
    id: "2026-11-23d",
    date: "November 23, 2026",
    title: "Today's attention: denser queue + shared Discard",
    staffOnly: true,
    items: [
      "Today's attention on Home is now a compact tabbed queue — one-line rows with priority, primary action, and less vertical scroll so you can clear receipt checks, missing recaps, and unstaffed shifts faster.",
      "Use arrow keys / j k to move, Enter to open, and d to Discard. Discard (and Discard visible) clears that notice for every Ignite admin — not a private hide — so it stays gone on refresh for the whole team.",
    ],
  },
  {
    id: "2026-11-23g",
    date: "November 23, 2026",
    title: "Staff tools stay behind Admin view (including billing)",
    staffOnly: true,
    items: [
      "Brand clients can no longer open Ignite-only pages by typing the URL — Billing, Missing Recaps, Users, Chat, catalogs and the rest of the internal queue now show an admin-view notice instead of the screen.",
      "The Admin / Client toggle stays limited to Ignite staff and exact Spark Admin roles; Brand Admin accounts remain in client chrome and cannot flip the toggle by editing storage.",
    ],
  },
  {
    id: "2026-11-23h",
    date: "November 23, 2026",
    title: "Upcoming activations no longer count as recaps due",
    items: [
      "The sidebar recaps-due badge, Missing Recaps, Master Tracker and the client Needs-you tile only flag past activations — scheduled demos still in the future never show as due.",
      "Status uses the activation date after a reschedule, so a moved-forward event does not look overdue while it is still upcoming.",
    ],
  },
  {
    id: "2026-11-23f",
    date: "November 23, 2026",
    title: "Finance queue: Unmatched cost / receipt filter",
    staffOnly: true,
    items: [
      "On Finance Queue, pick Unmatched cost / receipt in the exception filter — it matches API type unmatched_transaction and still includes legacy unmatched_cost rows.",
      "Link visit on those rows works the same as before once the filter finds them.",
    ],
  },
  {
    id: "2026-11-23m",
    date: "November 23, 2026",
    title: "Map this store: suggested match without the typing jank",
    staffOnly: true,
    items: [
      "Opening Map this store on an unmatched recap now suggests a store from the typed address (Places + OpenAI) with Confirm when confidence is high — you still confirm before it sticks.",
      "Searching while mapping no longer remounts the card on every keystroke, so focus and typing stay stable.",
    ],
  },
  {
    id: "2026-11-23e",
    date: "November 23, 2026",
    title: "Clean vs Needs Eyes photo triage on Needs review",
    staffOnly: true,
    items: [
      "On Needs review, staff can filter All / Clean / Needs Eyes so photo-ready recaps sort first and exceptions get eyes.",
      "Approve all Clean only lights up after triage finishes — pending or missing labels never count as Clean. Brand clients never see the pill or counts.",
    ],
  },
  {
    id: "2026-11-23s",
    date: "November 23, 2026",
    title: "AI aisle coach and Store Prep Kit on BA shift cards",
    staffOnly: true,
    items: [
      "When a BA uploads a shelf-bucket photo on check-in, Spark can nudge clearer aisle framing before they submit (non-blocking; works offline without blocking the shift).",
      "A Store Prep Kit card on check-in and booked job-board shifts pulls logistics, last shelf notes, SKUs, BA materials and stock-risk so ambassadors walk in prepared.",
    ],
  },
  {
    id: "2026-11-23a",
    date: "November 23, 2026",
    title: "Today's attention is staff-only (cleaner admin strip)",
    staffOnly: true,
    items: [
      "Brand clients no longer see Today's attention on the dashboard — ops queues stay Ignite-side.",
      "For staff, the strip groups by bucket with counts, a View all link, and compact action buttons.",
    ],
  },
  {
    id: "2026-11-23p",
    date: "November 23, 2026",
    title: "Live Photo Wall and shareable Buyer Pitch Decks",
    items: [
      "Open Photo Wall to browse in-store recap photos by retailer, market and SKU, then pin keepers straight into a Buyer Pitch Deck.",
      "From Buyer Report, mint a passcode-protected share link (with optional expiry and cost line) so a buyer can open a branded pitch leave-behind on client.igniteproductions.co — no Spark login required.",
    ],
  },
  {
    id: "2026-11-23r",
    date: "November 23, 2026",
    title: "POS feed inbox, portal presets and Monday buyer digests",
    items: [
      "On Retailer POS, pick a portal preset, turn on an automated feed, and review recent drops in the inbox alongside import history — less manual CSV chasing.",
      "On Buyer Report, opt into a Monday weekly buyer digest and set recipient overrides separately from field-marketing client digests.",
    ],
  },
  {
    id: "2026-11-23c",
    date: "November 23, 2026",
    title: "Shifts Board: overlapping shifts stay readable",
    items: [
      "When several shifts land in the same hour on the week view, chips now sit side by side instead of stacking through each other, so time, venue and market stay clear.",
    ],
  },
  {
    id: "2026-11-23u",
    date: "November 23, 2026",
    title: "Onboarding marketing UTMs land in Close",
    staffOnly: true,
    items: [
      "Self-serve onboarding now captures utm_source, campaign and content from the signup link (held for 30 minutes) and sends them with the lead into Close, so Ignite can see which pricing/marketing path converted.",
    ],
  },
  {
    id: "2026-11-22w",
    date: "November 22, 2026",
    title: "Multi-store wave booking and slide-over store drawer",
    items: [
      "On the Account Map, select multiple stores (or all filtered stores) to schedule a multi-store demo wave in one slide-over sheet: pick your activation type, dates, start and end times, SKUs and notes without exporting a spreadsheet.",
      "Click any store on the Master Tracker, Recaps, Approvals or Insights to open its visits, totals, products and photos in a slide-over Store Drawer without losing your active table or report filters.",
      "Both the Store Drawer and full store page include header quick actions: Schedule visit prefills a new request for that store, and Staff can use Rebook last crew to book the previous ambassador team again.",
      "Save persistent store logistics notes on any store, including parking, demo table setup and manager check-in, so future shifts keep those details on hand.",
    ],
  },
  {
    id: "2026-11-22j",
    date: "November 22, 2026",
    title: "Instant workspace switching and upgraded Jump (⌘K)",
    items: [
      "Switch between client workspaces without a full page reload while keeping your active route on lists, maps, schedules and reports instead of resetting to Home.",
      "Jump (⌘K / Ctrl K) now runs single-query search across pages, stores, requests, events and recaps with built-in quick actions: Switch client, Copy link (standing check-in or public request link) and New request.",
      "Staff: selecting an ambassador in Jump opens their profile cleanly on the talent roster.",
      "Multi-page dashboards, approvals and reports load faster, with automatic session refresh in the background so long forms and uploads don't time out.",
    ],
  },
  {
    id: "2026-11-22r",
    date: "November 22, 2026",
    title: "Receipt spend auto-fill, pre-submit checks and Camera Roll",
    staffOnly: true,
    items: [
      "Uploading a receipt photo during a check-in recap now reads the receipt spend automatically and offers one-tap auto-fill beneath the spend box to accept or ignore.",
      "Before submit, the check-in recap warns the BA when a receipt shows the wrong store, the wrong date or a duplicate receipt already submitted on another recap.",
      "Shift and tally-sheet photo fields on mobile check-in now support uploading from Camera Roll as well as live camera capture.",
    ],
  },
  {
    id: "2026-11-22c",
    date: "November 22, 2026",
    title: "Live shift tap counter, offline clock and job board self-serve",
    staffOnly: true,
    items: [
      "While clocked in on a check-in link, BAs have an offline SKU sample and unit tap counter plus a shopper quote scratchpad that auto-fill the recap form at shift end.",
      "Standalone time-clock links (/clock/:token) now queue punches offline in back-of-store dead zones and send the original punch time once signal returns.",
      "Booked shifts on the job board (/jobs/:token) include .ics download and Google Calendar links with the shift's check-in and prep details.",
      "BAs can release a shift themselves on /jobs/:token more than 36 hours before start time with a reason, reopening the slot and notifying staffing; inside 36 hours, Spark directs them straight to staffing.",
    ],
  },
  {
    id: "2026-11-21s",
    date: "November 21, 2026",
    title: "BAs can fix a wrong store after clocking in",
    staffOnly: true,
    items: [
      "Once a BA has clocked in on a walk-up link, the check-in page shows the store and address the shift is logged at, with a “Wrong store? Fix it” link until their recap is filed. Time-sheet brands see “Wrong location? Fix it” with the address only.",
      "Tapping it uses the phone's location: “You're at 123 Main St. Is this where you're working?” The store name is filled in when Spark already knows a store there. The BA can search the brand's stores or type an address instead, including when location is off.",
      "If the chosen address is more than 1 km from the phone, the BA has to tap “I'm sure” before the shift moves, and the Walk-ups card says they did. The clock-in time, hours and mileage stay as they were.",
      "A store Spark has never seen is added to the brand's retailers once (never twice). The Walk-ups card shows “Store changed by BA from … to … at …”, and “New store created by the BA, not yet reviewed” with a link to rename or merge it.",
      "Only walk-in shifts the BA's own check-in started that nobody else is on can be moved. Scheduled events and shared shifts tell the BA to message their lead. If another walk-up is already open at the corrected store that day, the two are not merged.",
    ],
  },
  {
    id: "2026-11-21g",
    date: "November 21, 2026",
    title: "Easier to check in at a second location",
    items: [
      "After clocking out, the \"Check-in for another gig\" button now sits right under the time clock instead of at the bottom of the page, so BAs moving to a new store can find it.",
      "The \"Clocking in for a new shift? Tap here\" link is now dark text on every brand, so it no longer disappears on light brand colours.",
    ],
    staffOnly: true,
  },
  {
    id: "2026-11-21p",
    date: "November 21, 2026",
    title: "BAs can preview the recap before they clock in",
    staffOnly: true,
    items: [
      "The walk-up check-in page has a “Preview the recap” button. On a link with more than one program it appears once the BA picks their event type; on a single-program link it is there from the start. It opens every recap question in order (with the answer choices), which ones are required, and the photos to take. Nothing can be typed, and opening it doesn't check the BA in or start a shift.",
      "The preview starts with a “Before your shift” checklist built from the form: the numbers to keep count of, the answers to be ready for, and each photo section with how many to take.",
      "Shift confirmation and reminder emails now have a “Preview your recap” button that opens the same preview with no login, for that shift's program. The check-in link stays in the email, worded for the day of the shift.",
      "Once opened, the preview works with no signal on that phone. Time-sheet-only brands have no recap, so they don't get the button or the email link.",
    ],
  },
  {
    id: "2026-11-20p",
    date: "November 20, 2026",
    title: "BAs can fix a wrong program on the check-in page",
    staffOnly: true,
    items: [
      "On a walk-up link with more than one program, the check-in page now shows the BA's program with a “Wrong program? Change it” link until their recap is filed. They pick the right program, confirm, and get that program's recap form. Their clock-in, hours and location stay as they were.",
      "Answers that exist on both forms carry over, and photos are kept. A photo whose section isn't on the new form moves to Other photos. Switching to Retail Sampling asks for the store name if the shift doesn't have one.",
      "The BA can only switch a walk-in shift their own check-in started that nobody else is on. Scheduled events and shifts other BAs have joined tell them to message their lead instead.",
      "The Walk-ups card shows “Program changed by BA from … to … at …” when a BA switched.",
    ],
  },
  {
    id: "2026-11-20o",
    date: "November 20, 2026",
    title: "Walk-up recaps survive a bad connection",
    items: [
      "If a BA's phone loses signal while they submit a recap, the check-in page now keeps it on the phone and says so: “Saved on your phone — we'll send your recap when you have signal.” It retries on its own and has a Send now button. A blank or error page no longer makes it look like their answers are gone.",
      "If the page itself breaks, the BA sees “Your recap is saved on this phone” with Try again instead of a white screen, and staff get a note in the check-in issues log.",
      "A recap that is sent twice because the first answer never reached the phone is filed once.",
      "Walk-up links now require a full 10-digit cell number. If someone types a number that doesn't match but their name matches a BA who has worked the brand, the link asks “Is this you?” and shows the last two digits, so a typo doesn't create a second account.",
      "When a BA has to check in again on the same phone, the recap form offers to restore the answers and photos they had already entered.",
    ],
  },
  {
    id: "2026-11-20r",
    date: "November 20, 2026",
    title: "Receipt checks for staff",
    staffOnly: true,
    items: [
      "Spark now reads each receipt photo on a recap: store and store number, ticket, time, every line, fees, tax and total. It checks that the lines add up.",
      "A custom recap shows a Receipts panel (staff only) with what was read, the spend it adds up to, and any flags to look at.",
      "Flags cover the same receipt on two recaps, a receipt from a different store than the event, a clock-in of a few minutes on a recap that reports sales or consumers, a recap filed a week or more late by staff, and duplicate photos. Resolve each one with a short note.",
      "The new Receipt checks page (Recaps → Receipt checks) totals receipt spend for a brand and date range, each receipt counted once and split into brand product, other items, fees and tax, lists flagged recaps, and exports a CSV with one row per receipt for billing.",
      "Brand users never see flags or this page.",
    ],
  },
  {
    id: "2026-11-18c-1",
    date: "November 18, 2026",
    title: "Accepting the Terms",
    items: [
      "The first time you sign in after this update, Spark asks you to accept the Terms of Service and Acceptable Use Policy and confirm you've read the Privacy Policy. It takes one click, and links open each document in a new tab.",
      "If the terms change later, Spark asks again once and says what changed.",
      "Staff: see who has accepted, and when, under System, Legal acceptances.",
    ],
  },
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

/** Legacy shared key — migrated once per audience when the tip id still matches. */
const LEGACY_KEY = "@spark.whatsNew.seen";

export function whatsNewSeenKey(isClient: boolean): string {
  return isClient ? "@spark.whatsNew.seen.client" : "@spark.whatsNew.seen.staff";
}

/** The entries this viewer may see: staff-only notes stay out of client view. */
export function whatsNewFor(isClient: boolean): WhatsNewEntry[] {
  return isClient ? WHATS_NEW.filter((e) => !e.staffOnly) : WHATS_NEW;
}

function readSeenId(isClient: boolean): string | null {
  const keyed = window.localStorage.getItem(whatsNewSeenKey(isClient));
  if (keyed != null) return keyed;
  // Pre-split key: only honor it for this feed when it matches this feed's tip,
  // so a client-mode mark does not clear a newer staff-only tip (and vice versa).
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  const tip = whatsNewFor(isClient)[0]?.id;
  return legacy != null && tip != null && legacy === tip ? legacy : null;
}

export function hasUnseenWhatsNew(isClient = false): boolean {
  try {
    return readSeenId(isClient) !== whatsNewFor(isClient)[0]?.id;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(isClient = false): void {
  try {
    const latest = whatsNewFor(isClient)[0];
    if (!latest) return;
    window.localStorage.setItem(whatsNewSeenKey(isClient), latest.id);
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

/** Shared inbox for the account-menu "Send feedback" mailto. */
export const FEEDBACK_RECIPIENTS = ["events@igniteproductions.co"];

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
