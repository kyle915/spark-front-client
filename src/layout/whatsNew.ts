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
    id: "2026-11-27hk",
    date: "November 27, 2026",
    title: "Admin Help Knowledge Base, OpenAI Embeddings & Chat AI Assist",
    staffOnly: true,
    items: [
      "Ask Spark now includes a Program Data / Spark Help (Admin) switcher grounded in Spark product guides and OpenAI semantic embeddings (text-embedding-3-small) — with strict audience isolation (clients cannot see admin guides or add knowledge) and guardrails blocking internal Ignite financials or processes.",
      "Inside /chat, Ignite admins can click Draft AI to draft BA replies from shift context, brand product knowledge, and Spark Help docs (always editable before sending), and click Teach Spark on any admin reply to distill a PII-scrubbed product FAQ into Spark Knowledge.",
      "Open System → Help Knowledge (/help-knowledge) to review unanswered or flagged Knowledge Gaps, publish/edit audience-scoped articles, sync OpenAI embeddings, and test Client vs. Admin visibility side by side.",
    ],
  },
  {
    id: "2026-11-27ah",
    date: "November 27, 2026",
    title: "Instant Spark guidance inside Ask Spark",
    items: [
      "Ask Spark now answers how-to questions about whichever screen you're viewing — including Demo Costs, Shelf & Voice, Buyer Report, Retailer POS, and AI Connector — with direct links to the right page.",
      "Can't find what you need? Click Not helpful? under any reply to flag it for your Ignite team so our guides keep getting smarter.",
    ],
  },
  {
    id: "2026-11-27sg",
    date: "November 27, 2026",
    title: "Interactive Spark Setup Guide",
    items: [
      "Open Setup Guide in the Workspace sidebar for step-by-step walkthroughs of Shelf & Voice, Buyer QBR Decks, automated Friday digests, outbound webhooks, and connecting Claude or ChatGPT — with live readiness progress.",
    ],
  },
  {
    id: "2026-11-27sb",
    date: "November 27, 2026",
    title: "Admin-only Sample Brand Sandbox preview",
    staffOnly: true,
    items: [
      "Ignite admins can preview the read-only Sample Brand Sandbox (/sandbox — linked from Settings and Setup Guide) powered by fictional brand Meadowlark Botanicals and made-up retailer, store, and competitor data ahead of a future public launch.",
    ],
  },
  {
    id: "2026-11-27sv",
    date: "November 27, 2026",
    title: "Saved Report Views, Friday Digests & Automated Webhooks",
    items: [
      "Save custom regional or retailer filter views (like 'Texas Whole Foods · Last 90 Days') on Buyer Report and Shelf & Voice, switch back in one click, and schedule automated Friday email digests with CSV attachments — or click Send now anytime.",
      "Connect Spark to Zapier, HubSpot, Klaviyo, or Airtable from AI Connector with secure webhooks for approved recaps, new requests, and out-of-stock alerts — complete with one-click test pings and delivery history.",
    ],
  },
  {
    id: "2026-11-27sh",
    date: "November 27, 2026",
    title: "Shelf Compliance, Pricing & Competitor Insights",
    items: [
      "Open Shelf & Voice under Reports & ROI to monitor on-shelf availability, price-tag compliance, and average facings. Enter your Target MSRP to spot price drift, missing tags, and out-of-stock stores — and click any store for full visit details.",
      "Compare Before & After shelf photos across repeat visits, browse audited aisle shots full-screen, and track rising competitor mentions, field promo alerts, and buyer-ready shopper quotes by market.",
    ],
  },
  {
    id: "2026-11-27qb",
    date: "November 27, 2026",
    title: "One-Click Buyer QBR Decks & PowerPoint Export",
    items: [
      "Generate co-branded Buyer QBR and Line-Review decks straight from Buyer Report or Photo Wall — featuring your national footprint map, 4-week POS lift, shelf compliance, shopper feedback themes, and pinned field photos.",
      "Share a live buyer link (with optional passcode and cost toggle) or export an editable 16:9 PowerPoint (.pptx) deck for PowerPoint, Keynote, and Google Slides.",
    ],
  },
  {
    id: "2026-11-27pr",
    date: "November 27, 2026",
    title: "Richer Program Reports, CSV Exports & Anywhere Ask Spark",
    items: [
      "Program Reports now includes period-over-period comparisons, metric switchers, expandable data tables, a sampling-to-sale funnel, and one-click CSV and executive brief exports.",
      "Open Ask Spark from any screen via Jump (⌘K), the mobile bar, or a store profile with tailored starter prompts, and review recaps faster using the slide-over Quick-Peek panel.",
    ],
  },
  {
    id: "2026-11-27pl",
    date: "November 27, 2026",
    title: "Refreshed Light Theme, Full-Screen Photos & Smoother Brand Switching",
    items: [
      "Shared request forms, email approval cards, and event share links now share Spark's clean, bright studio theme.",
      "Browse field photos full-screen in the Photo Gallery, view a cleaner light map on Schedule, and switch smoothly between brand workspaces across Reports & ROI, Retailer POS, Budget Pacing, and Demo Costs.",
    ],
  },
  {
    id: "2026-11-26st",
    date: "November 26, 2026",
    title: "Refreshed Spark Workspace & Recent Field Proof",
    items: [
      "Your Spark workspace now has a cleaner, calmer layout with a slimmer header bar and crisp, easy-to-scan KPI numbers across every dashboard and report.",
      "Your Dashboard now includes a Recent Field Proof strip highlighting your latest approved setup and sampling photos with store and date captions.",
    ],
  },
  {
    id: "2026-11-26ux",
    date: "November 26, 2026",
    title: "Streamlined Navigation, Collapsible Sidebar & Quick-Peek",
    items: [
      "Schedule, Photos, and Reports & ROI are organized into focused hubs with top sub-tabs, and you can collapse the desktop sidebar anytime with the [ key for extra viewing room.",
      "Click any row in My Requests or Approvals to open a slide-over Quick-Peek summary — view details, open store profiles, or jump to the full page without losing your place.",
      "Your Dashboard brings Weekly Velocity, Top Stores, By State, and SKU Mix into one clean tabbed view right beside your recommended Next Moves.",
    ],
  },
  {
    id: "2026-11-26oh",
    date: "November 26, 2026",
    title: "One-handed demo table controls on Field Check-In",
    staffOnly: true,
    items: [
      "Walk-up check-in recaps now show a live top completion bar (with a one-tap Jump to next link) so BAs can see exactly what's left before packing up.",
      "Photo buckets and quick photo slots (+ Setup, + Sampling Action, + Receipt) turn crisp green as shots finish uploading.",
      "Sample, SKU, and engagement count fields add +1, +5, and +10 quick-tap stepper pills for fast one-handed entry at the demo table.",
    ],
  },
  {
    id: "2026-11-26nl",
    date: "November 26, 2026",
    title: "Schedule in Plain English & Account Map Store Signals",
    items: [
      "Type a single sentence on Create Request — such as 'Every Fri & Sat in June from 12pm to 4pm at our top 5 Austin HEBs' — to match stores from your Account Map and preview a full multi-visit schedule ready to submit in one click.",
      "Approved recaps automatically highlight actionable Store Signals from field notes, including out-of-stock risks, buyer reorder leads, store manager contacts, and competitor promotions.",
      "Account Map adds an Out-of-Stock & Reorder Leads filter and a Store Signals panel with one-click partner follow-up email drafts, wave selection, and quick demo scheduling.",
    ],
  },
  {
    id: "2026-11-26wp",
    date: "November 26, 2026",
    title: "Plan Your Next Demo Wave in Ask Spark",
    items: [
      "Ask Spark can now draft an upcoming multi-store demo wave based on your conversion rates, sales volume, and overdue accounts — automatically skipping stores that already have a visit scheduled.",
      "Click Create wave right inside Ask Spark to open Account Map pre-loaded with those stores, recommended days, and peak hours — nothing submits until you review and confirm.",
      "Your weekly sampling chart now scales cleanly when a large event week spikes above regular retail weeks, keeping store-by-store trends easy to read.",
    ],
  },
  {
    id: "2026-11-26sc",
    date: "November 26, 2026",
    title: "Real-time setup & shelf photo coaching on Check-In",
    staffOnly: true,
    items: [
      "Walk-up check-in now coaches Table Setup, Event Setup / Footprint, and Display photos in addition to Shelf and Cooler shots — flagging blurry or dark captures, missing product on the setup, or labels turned away while the BA is still on site.",
      "Photo advisories now highlight warnings clearly under each thumbnail with one-tap Retake (camera), Replace (library), and Keep buttons, without ever blocking recap submission.",
    ],
  },
  {
    id: "2026-11-26ha",
    date: "November 26, 2026",
    title: "Interactive Charts, 1-Click Wave Planning & Rebook from Any Recap",
    items: [
      "Click any store bar to open its Store Profile, click any state bar to open your Account Map filtered to that state, and switch to Typical weeks scale whenever a big event week would flatten normal retail trends.",
      "Worth a Look and Where to Go Next now include direct Plan wave and Schedule demo buttons, and Account Map adds an Overdue 60+ days filter with one-click wave booking.",
      "Every recap detail page now includes Rebook store (pre-filled with venue, address, and store number) and Ask Spark, while Photo Wall lets you pin standout shots right from the corner of each photo.",
    ],
  },
  {
    id: "2026-11-26qa",
    date: "November 26, 2026",
    title: "Approvals Upcoming vs. Past-due triage, Recap QA checks, and workspace summaries",
    staffOnly: true,
    items: [
      "Approvals decodes full REQ numbers (REQ-1481 instead of base64 suffixes), splits Pending into All, Upcoming, and Past-due tabs, and adds a one-click Decline all past-due flow.",
      "Recap Quality now deducts points when audience sub-counts (such as willing + not willing) exceed total consumers sampled, and Photo buckets counts photos stored in matching template image fields.",
      "Client Summaries defaults to the active workspace (with All brands one click away), Staffing Board pins the venue column while scrolling and shows readable BA names (Dana B.), and Light-mode route loading skeletons no longer flash dark.",
    ],
  },
  {
    id: "2026-11-26ops",
    date: "November 26, 2026",
    title: "Field upload bar, Staffing Board scope, and DST-accurate imports",
    staffOnly: true,
    items: [
      "Field check-in recaps now pin a live status bar at the top when offline, uploading photos, or retrying failed uploads, with a one-tap Retry button.",
      "Staffing Board filters by client on the server when a workspace is picked, so busy multi-client weeks don't cut off shifts past the row cap.",
      "Bulk request spreadsheet imports convert venue wall-clock times using daylight-saving-aware time zones instead of a fixed offset.",
      "P&L and Field Sampling warnings now use high-contrast text in light mode, and Edit Event shows missing-field validation as an error.",
    ],
  },
  {
    id: "2026-11-26cal",
    date: "November 26, 2026",
    title: "Calendar Day, Week & Month Views + Click-to-Schedule",
    items: [
      "Switch smoothly between Day, Week, and Month views on Schedule, with easy scrolling on phones and full-day coverage for early-morning or evening events.",
      "Click any open time slot or Schedule demo to open a new request pre-filled with that date and time.",
    ],
  },
  {
    id: "2026-11-26req",
    date: "November 26, 2026",
    title: "Repeat Weekly Demos & Faster Request Editing",
    items: [
      "Use + Repeat weekly ×3 on Create Request to schedule three weekly visits at the same store in a single click.",
      "Address autocomplete carries exact store locations straight into new and edited requests, keeping local event times accurate year-round.",
    ],
  },
  {
    id: "2026-11-26up",
    date: "November 26, 2026",
    title: "Reschedule Upcoming Demos & Catch Missing Details Early",
    items: [
      "Upcoming demos that still need approval or a street address are clearly highlighted so details are easy to catch before event day.",
      "Scheduled upcoming events now include a Change date button right in the list and update immediately as soon as you save.",
    ],
  },
  {
    id: "2026-11-26app",
    date: "November 26, 2026",
    title: "Faster Approvals Filtering & Account Map Loading",
    items: [
      "Filter your Approvals queue by With photos or No photos and search by store, market, or program to review larger queues faster.",
      "Large store lists on your Account Map now load dramatically faster so you can explore coverage without waiting.",
    ],
  },
  {
    id: "2026-11-25mr",
    date: "November 25, 2026",
    title: "One receipt per photo",
    staffOnly: true,
    items: [
      "The check-in receipt upload now tells BAs to take one photo per receipt. If a photo still shows two or more receipts, they see a warning to photograph each one separately before they submit.",
      "Receipt checks flags any photo that holds several receipts (Several receipts in one photo), since only one of them is read. The receipt reader also no longer mistakes a store's savings total for the receipt total.",
    ],
  },
  {
    id: "2026-11-24tc",
    date: "November 24, 2026",
    title: "Talent search finds every BA",
    staffOnly: true,
    items: [
      "The search box on Talent now searches the whole roster, not just the BAs already on screen. Type a name, an email, or a phone number in any format. The roster loads 50 at a time, with Load more at the bottom.",
    ],
  },
  {
    id: "2026-11-24dw",
    date: "November 24, 2026",
    title: "Pick the Recaps date window from the chip",
    staffOnly: true,
    items: [
      "Click the 30 days chip on Recaps to switch to 60 days, 90 days, or All time. A recap waiting for review that is older than 30 days is one click away.",
    ],
  },
  {
    id: "2026-11-24sb",
    date: "November 24, 2026",
    title: "Staffing Board opens on your workspace",
    staffOnly: true,
    items: [
      "The Staffing Board's client picker starts on the workspace you're in, marked (this workspace). Pick All clients to see every brand's week, and switching workspaces moves the board with you.",
    ],
  },
  {
    id: "2026-11-24rc",
    date: "November 24, 2026",
    title: "Recaps catch answers that disagree before they go in",
    staffOnly: true,
    items: [
      "When a BA taps Submit on a check-in link, Spark now looks for answers that cannot both be right: a total sold of 0 next to lines that sold, sales with 0 people sampled, more first-time or brand-aware people than were sampled, more swag given out than was on hand, an end count that is not start minus given, spend that does not match the receipts, a clock that runs well past or short of the shift, and a number far above what this program usually reports.",
      "Each note sits under the field it is about, marked Likely error or Check this, with Fix and This is correct. Nothing blocks the recap: the BA can always confirm and submit.",
      "Reviewers see what the BA was asked under Review checks, in an Asked at submit block, so they can see at a glance that the BA confirmed 15 upgrades and 0 tins sold. The Needs review queue marks those recaps BA confirmed or BA check.",
    ],
  },
  {
    id: "2026-11-24am",
    date: "November 24, 2026",
    title: "Cleaner Store Names, Market Filters & Last Demo History on Account Map",
    items: [
      "Stores and retail chains on your Account Map now group cleanly by retailer name without extra visit dates cluttering the menu.",
      "Narrow your map by city and state with the Market filter, and see each store's most recent completed demo right on its card and list row.",
    ],
  },
  {
    id: "2026-11-24ui",
    date: "November 24, 2026",
    title: "Cleaner Layouts on Mobile & Smaller Screens",
    items: [
      "Your sidebar groups My Requests, Approvals, Plans, and Bulk Upload cleanly while keeping My Recaps and Photos in their own section.",
      "Mobile screens wrap cleanly into easy-to-scan cards without sideways scrolling, and page transitions feel smooth with no layout flicker.",
      "Search, status, filters, and sorting now sit together in one clean bar across your request and recap lists.",
    ],
  },
  {
    id: "2026-11-24ta",
    date: "November 24, 2026",
    title: "Talent shows phone and market for walk-ups",
    staffOnly: true,
    items: [
      "BAs who joined through a walk-up check-in link show their phone number and where they last worked (market and brand) instead of the internal checkin address. Search by phone in any format.",
      "Field sampling report: the samples headline is the sum of the SKU rows below it. When a week has no per-SKU counts it says which number it used instead.",
      "P&L and the photo wall print each event date once, in one format, and drop the date that walk-in event names repeat.",
      "Client view on Home counts recaps the way the brand does, approved only, so the preview shows the brand's numbers.",
    ],
  },
  {
    id: "2026-11-24tb",
    date: "November 24, 2026",
    title: "Consistent Dashboard Totals & Cleaner Field Photos",
    items: [
      "Your headline Consumers Sampled total matches your weekly chart for the exact same dates, counting approved recaps on the day each activation ran.",
      "Where engagements are only tracked on select events, they are clearly labeled Engagements Logged so your metrics stay easy to interpret.",
      "Dashboard photos load smoothly with clean placeholders, long shopper quotes expand cleanly with Show more, and your Timeline lists Upcoming, Today, Recapped, and Recap Pending events newest first.",
    ],
  },
  {
    id: "2026-11-24b",
    date: "November 24, 2026",
    title: "Click Any KPI to See How It's Calculated",
    items: [
      "Click any Program KPI tile to see exactly which approved recaps and fields add up to the headline figure.",
      "Recaps awaiting approval appear clearly as '+3 pending approval', and metrics not tracked for a program display 'Not tracked' instead of 0.",
    ],
  },
  {
    id: "2026-11-24a",
    date: "November 24, 2026",
    title: "Recap templates check their numbers before going live",
    staffOnly: true,
    items: [
      "Saving or creating a recap template now warns when a standard number (units sold, consumers sampled, and so on) has no field, or when a count like “How many shoppers took the upgrade?” would not be added to anything. Choose Save anyway, or Save and review mapping to jump to the mapping card.",
      "In a KPI tile's explanation, staff get a Fix mapping link straight to that form's mapping card.",
    ],
  },
  {
    id: "2026-11-23af",
    date: "November 23, 2026",
    title: "The queue is the page",
    staffOnly: true,
    items: [
      "Recaps has one search, and the number is labeled Engagements. Scan is one line: who, activation, date, status, and engagements. Cards, dates, export, map, select, pin, and jump are under More. The Recaps breadcrumb no longer repeats, and Scoring Clean clears once triage finishes.",
      "Master Tracker opens on Pending. Scheduled is the request count and matches All, not the rows in view. Sheet and export sit in one menu, and the file says how many rows it actually holds. All-time consumers, first-time, and products purchased stay on Insights.",
      "Account map opens on the map, coverage, and the store list. Each suggestion is one line. Retailers that differ only by capital letters are one chain, and a date is not a retailer. Select all stays off until the list is filtered. The account roster sits on one line next to the coverage chips.",
      "Walk-ups keeps this brand's standing code pinned, with a brand or code search. Photo buckets stay closed until you open the row. Codes are not reminted. Clock links stay the third tab.",
      "An empty Today keeps the sentence and links the recap, missing-recap, and approval queues, without the zero tiles. The Master Tracker count is quiet text, not an orange badge. A dot on your avatar means What's New is unseen.",
    ],
  },
  {
    id: "2026-11-23ae",
    date: "November 23, 2026",
    title: "Famus recaps end with a store sign-off",
    staffOnly: true,
    items: [
      "On a Famus recap, the form now ends with a store sign-off. The clerk types a first name and one last initial, then signs with a finger or a mouse.",
      "That name and signature stay on the recap. Staff and the client both see them when the recap is opened.",
    ],
  },
  {
    id: "2026-11-23ad",
    date: "November 23, 2026",
    title: "Check-in boxes say what to type",
    staffOnly: true,
    items: [
      "On a walk-up check-in link, every box under Who's working and Where are you working now has a label you can read before you tap it: first name, last name, mobile phone, email, and the store, venue, or market. The hint inside the box is dark text on white, so an empty box no longer hides what it's asking for.",
    ],
  },
  {
    id: "2026-11-23ac",
    date: "November 23, 2026",
    title: "Smarter Date Awareness in Ask Spark",
    items: [
      "Ask Spark understands relative questions like 'last month', 'this month', and 'which stores should we visit next month' using your current program year and exact Dashboard numbers.",
      "Every reply stays grounded exclusively in your brand's data and links directly to the Spark pages behind the numbers.",
    ],
  },
  {
    id: "2026-11-23b",
    date: "November 23, 2026",
    title: "Executive Brief at the Top of Program Reports",
    items: [
      "Your Program Report opens with a concise executive brief summarizing what worked across your selected date range, built from approved recaps.",
      "Shopper themes, competitor mentions, shelf highlights, and standout field photos sit right up top above the full performance charts.",
    ],
  },
  {
    id: "2026-11-23ab",
    date: "November 23, 2026",
    title: "Clearer Conversion Metrics & Top Store Highlights in Reports",
    items: [
      "Your Program Report KPI bar includes retail and on-premise Conversion Rate (units sold divided by consumers sampled) right alongside Purchase Intent.",
      "Monthly highlights spotlight your top-performing store's approved recaps, units sold, full shopper quotes, and best field photos — one clean shot per store and date.",
      "Samples handed out and competitor brand mentions are labeled clearly and consistently across every chart and table.",
    ],
  },
  {
    id: "2026-11-23x",
    date: "November 23, 2026",
    title: "The work sits above the controls",
    staffOnly: true,
    items: [
      "Recaps has one search. The number is labeled Engagements. Cards, dates, export, map, select, pin, and jump are under More.",
      "Master Tracker keeps the request count. All-time consumers, first-time, and products purchased stay on Insights. Export says how many rows are actually in the file.",
      "Account map opens on the map, coverage, and store list. Each suggestion is one line. Select all stays off until the stores are filtered.",
      "Walk-ups pins this brand's standing code and adds a brand or code search. Photo buckets stay closed until you open the row. Codes are not reminted.",
      "An empty Today links the recap, missing-recap, and approval queues. The Master Tracker count is quiet text, not a queue badge.",
    ],
  },
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
    title: "Auto-Drafted Buyer Deck Captions & Clearer Finance Queue Notes",
    items: [
      "Buyer Pitch Decks now draft polished photo captions and a concise sell-story from your best field photos, shopper feedback, and shelf highlights — while keeping all revenue and lift figures anchored to your verified report data.",
      "Exceptions in your Finance Queue now include a ready-to-share summary with key receipt details and suggested next steps for faster resolution.",
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
    title: "Wider, Easier-to-Scan Recap Layout",
    items: [
      "Recap pages and shared recap links arrange Shift Overview, Brand Results, Shopper Feedback, and Follow-Up in a clean two-column layout right beside your field photos.",
    ],
  },
  {
    id: "2026-11-23t",
    date: "November 23, 2026",
    title: "Email Links Open Directly into the Right Brand",
    items: [
      "Links in Spark notifications and digest emails open straight into the matching brand workspace automatically — ideal when your team manages multiple brands.",
      "Improved light-mode text contrast across headers and Ask Spark panels for effortless reading.",
    ],
  },
  {
    id: "2026-11-23k",
    date: "November 23, 2026",
    title: "Headline Recap Metrics Front and Center",
    items: [
      "Engagements, Units Sold, Conversion, and Photos sit right beneath the recap title on desktop and mobile so key results are visible the moment you open a recap or shared link.",
    ],
  },
  {
    id: "2026-11-23q",
    date: "November 23, 2026",
    title: "Ask Spark Covers Shelf Compliance, Demo Costs, POS & Competitors",
    items: [
      "Ask Spark — along with your Claude and ChatGPT AI Connector — now answers questions about on-shelf compliance, demo cost rollups, retailer POS velocity and ROI, and competitor mentions from field recaps.",
      "Every figure matches your Spark reports directly, with workspace permissions keeping sensitive cost and POS data private to your brand team.",
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
    title: "More Accurate Upcoming & Pending Recap Statuses",
    items: [
      "Future scheduled activations never appear as overdue recaps — your Dashboard and request statuses only highlight completed past events waiting on a recap.",
      "Rescheduling an event immediately updates its status to reflect the new activation date.",
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
    title: "Live Photo Wall & Shareable Buyer Pitch Decks",
    items: [
      "Browse your in-store photos on the Photo Wall by retailer, market, and SKU, then pin standout shots straight into a Buyer Pitch Deck.",
      "Create a branded, shareable buyer link from Buyer Report — with optional passcode protection, expiration date, and cost visibility — ready for retail buyers to view with no login required.",
    ],
  },
  {
    id: "2026-11-23r",
    date: "November 23, 2026",
    title: "Automated Retailer POS Feeds & Monday Buyer Digests",
    items: [
      "Connect automated retailer POS feeds using built-in portal presets and review incoming drops alongside your import history on Retailer POS.",
      "Opt into a weekly Monday buyer digest right from Buyer Report with dedicated recipient controls.",
    ],
  },
  {
    id: "2026-11-23c",
    date: "November 23, 2026",
    title: "Cleaner Overlapping Events on Schedule Calendar",
    items: [
      "When multiple demos run during the same hour on your weekly Calendar view, event cards sit neatly side by side so times, stores, and markets stay easy to read.",
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
    title: "Multi-Store Wave Booking & Slide-Over Store Profiles",
    items: [
      "Select multiple stores right on your Account Map to schedule a multi-store demo wave in one step — pick your event type, dates, start and end times, SKUs, and notes without exporting a spreadsheet.",
      "Click any store in My Requests, My Recaps, Approvals, or Reports to open its visit history, totals, products, and photos in a slide-over Store Profile without losing your current filters.",
      "Save persistent store notes — like parking tips, demo table setup, and manager check-in instructions — so details stay on hand for every future visit.",
    ],
  },
  {
    id: "2026-11-22j",
    date: "November 22, 2026",
    title: "Instant Workspace Switching & Faster Jump Search (⌘K)",
    items: [
      "If you manage multiple brands, switch workspaces instantly without losing your place on maps, schedules, lists, or reports.",
      "Press ⌘K (or Ctrl K) anywhere in Spark to search across pages, stores, requests, events, and recaps — or jump straight into starting a new request.",
      "Faster loading across dashboards, approvals, and reports with smoother background session handling while you work.",
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
    staffOnly: true,
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
    title: "One-Click Terms & Privacy Review",
    items: [
      "Review and accept Spark's Terms of Service, Acceptable Use Policy, and Privacy Policy in a single click at sign-in, with clear summaries whenever terms are updated.",
    ],
  },
  {
    id: "2026-11-19t",
    date: "November 19, 2026",
    title: "Time-sheet-only check-in links",
    staffOnly: true,
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
    staffOnly: true,
    items: [
      "When a BA's check-in would start a new walk-in event, the walk-up link now asks “Is your shift today?” first. If they tap No, it tells them to open the link when their shift starts, and nothing is created or clocked.",
      "Joining an event that's already on the tracker, filing a past-day recap and recap-only links don't ask.",
      "Short walk-in shifts, clocked in and out within 20 minutes, no longer get the “your recap isn't in yet” texts. Booked shifts still do.",
    ],
  },
  {
    id: "2026-11-18s",
    date: "November 18, 2026",
    title: "More Accurate Store Attribution on Your Dashboard",
    items: [
      "Field recaps match cleanly to the store and state where each retail demo ran, keeping your store-level and regional totals accurate across every dashboard and report.",
    ],
  },
  {
    id: "2026-11-18v",
    date: "November 18, 2026",
    title: "Festivals & Events Displayed by Venue Name",
    items: [
      "Your store performance charts list festivals and special events under their venue name — clearly labeled as venues so they stay distinct from retail stores.",
    ],
  },
  {
    id: "2026-11-18b-2",
    date: "November 18, 2026",
    title: "Sign In with Google for AI Connectors",
    items: [
      "Choose Continue with Google when connecting Claude, ChatGPT, or other AI apps to Spark for fast, secure workspace setup.",
    ],
  },
  {
    id: "2026-11-18c",
    date: "November 18, 2026",
    title: "Smart Search for Your Field Photos",
    items: [
      "Search your Photos library in plain English — like 'best crowd photos at Kroger in Texas' — and refine results with one-tap filters for shopper engagement, table setups, shelf displays, or signage.",
      "Hide blurry or dark shots in one click. Every photo shown comes exclusively from your brand's approved recaps.",
    ],
  },
  {
    id: "2026-11-17i",
    date: "November 17, 2026",
    title: "Launch a client: the new brand's products on the cloned form",
    staffOnly: true,
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
    staffOnly: true,
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
    staffOnly: true,
    items: [
      "Staff: the Payroll timesheet now checks each shift before you approve hours, and says how many need a look, such as \"7 of 212 shifts need a look\".",
      "It flags shifts worked past their booking, punches far from the store, shifts that overlap, recaps filed before the clock-out, auto-closed or hand-edited punches, and mileage above what GPS tracked. Each flag shows the facts and a suggested next step.",
      "Nothing is rejected for you. Mark a flag OK, reviewed and it stops asking unless the punches change. Turn on Needs a look to see only those BAs.",
    ],
  },
  {
    id: "2026-11-18r",
    date: "November 18, 2026",
    title: "Automatic Store Recommendations on Your Dashboard",
    items: [
      "Your Where to Go Next recommendations now update automatically as soon as recaps are approved, surfacing high-potential stores faster.",
    ],
  },
  {
    id: "2026-11-18i",
    date: "November 18, 2026",
    title: "Local Time Zone Accuracy in Insights",
    items: [
      "Last 7, 30, and 90-day date ranges in Insights align cleanly with your local time zone at every hour of the day.",
    ],
  },
  {
    id: "2026-11-17e-1",
    date: "November 17, 2026",
    title: "Complete List Loading & Clearer Status Messages",
    items: [
      "Long lists across your Dashboard, Schedule, My Requests, Approvals, Alerts, Reports, and Account Map load in full without truncation.",
      "Clear, friendly retry messages appear if you run several large exports back to back.",
    ],
  },
  {
    id: "2026-11-18b-1",
    date: "November 18, 2026",
    title: "Conversational Ask Spark on Your Dashboard",
    items: [
      "Chat with Ask Spark directly from your Dashboard to explore top-converting stores, upcoming priorities, and shopper feedback themes.",
      "Every answer draws strictly from your brand's verified Spark data with clickable source links, and stays read-only so you can explore freely.",
    ],
  },
  {
    id: "2026-11-18b",
    date: "November 18, 2026",
    title: "Product answers from brand documents and websites",
    staffOnly: true,
    items: [
      "Ambassadors: product questions on the check-in page are now also answered from the brand's uploaded documents and its own website, and each answer says where it came from, such as a product page or a sell sheet.",
      "Staff: on the BA product notes card under Walk-ups, Standing codes, add the brand's website, see every page and document Spark read, refresh them now, or exclude one. Your notes win when they disagree with the website.",
    ],
  },
  {
    id: "2026-11-18a-1",
    date: "November 18, 2026",
    title: "Actionable Store Recommendations & Weekly Alerts",
    items: [
      "Your Dashboard highlights Where to Go Next — surfacing top-converting stores worth revisiting alongside stores that need shelf or stock attention.",
      "Weekly Alerts give you concise heads-ups on stock gaps and notable shifts in store conversion, powered by your approved recaps.",
    ],
  },
  {
    id: "2026-11-17g-1",
    date: "November 17, 2026",
    title: "Shareable Campaign Recap Decks (PDF)",
    items: [
      "Download polished end-of-program recap decks right from your Program Report — complete with headline metrics, market coverage, shopper quotes, standout field photos, and recommended next steps.",
      "Visits with no product on hand are noted separately so your demo totals always match your Dashboard.",
    ],
  },
  {
    id: "2026-11-17h",
    date: "November 17, 2026",
    title: "Clearer Terms, Privacy Policy & Data Summary",
    items: [
      "Spark's updated Terms of Service, Privacy Policy, Acceptable Use Policy, and Brand Data Processing Summary are clearly organized and linked together for quick reference.",
    ],
  },
  {
    id: "2026-11-17g",
    date: "November 17, 2026",
    title: "Connect Spark to Claude or ChatGPT",
    items: [
      "Ask Claude or ChatGPT questions about your field program — including results, recaps, store performance, upcoming events, and pending approvals — using your Spark login via AI Connector in the sidebar.",
      "Connections are read-only, scoped strictly to your brand's data, protect ambassador privacy, and can be disconnected anytime.",
    ],
  },
  {
    id: "2026-11-17f-1",
    date: "November 17, 2026",
    title: "Month-by-Month Shopper Feedback Trends",
    items: [
      "Track how shopper themes and competitor mentions evolve over the last six months in Insights, showing whether each topic is rising, steady, or cooling alongside real shopper quotes.",
    ],
  },
  {
    id: "2026-11-18a",
    date: "November 18, 2026",
    title: "Product questions on the check-in page",
    staffOnly: true,
    items: [
      "Ambassadors: once you've checked in, ask a product question such as \"How much caffeine is in this?\" and get a short answer taken only from the brand's own notes. If the notes don't cover it, it says so — check with your lead.",
      "Staff: write each brand's BA product notes and see what ambassadors have been asking under Walk-ups, Standing codes.",
    ],
  },
  {
    id: "2026-11-17f",
    date: "November 17, 2026",
    title: "Clearer Geographic Performance Map",
    items: [
      "Your Geographic Performance map highlights active states with richer shading, on-map totals, and a ranked breakdown of each state's share.",
      "Regional programs automatically zoom into your active footprint, with a one-click option to view the full national map.",
    ],
  },
  {
    id: "2026-11-17e",
    date: "November 17, 2026",
    title: "Cleaner 7-Day Upcoming Schedule",
    items: [
      "Schedule presents your next 7 days in a clean day-by-day list showing start time, store, and address — highlighting only the events that still need attention.",
    ],
  },
  {
    id: "2026-11-17d",
    date: "November 17, 2026",
    title: "Spend needs a receipt photo",
    staffOnly: true,
    items: [
      "Ambassadors: if you enter product spend on a recap, add a photo of the receipt to the receipt group before you submit. The form tells you right away if it's missing.",
      "Staff editing a recap can still enter spend without a receipt.",
    ],
  },
  {
    id: "2026-11-17c",
    date: "November 17, 2026",
    title: "Self-Serve Event Rescheduling",
    items: [
      "Need a different day or time? Open any upcoming event and choose Change date — your Ignite team is notified immediately to confirm coverage.",
    ],
  },
  {
    id: "2026-11-17b",
    date: "November 17, 2026",
    title: "Smoother Multi-Brand Workspace Switching",
    items: [
      "If your account covers multiple brands, My Requests, Insights, Ask Spark, and event pages stay cleanly synced to whichever brand you have selected.",
    ],
  },
  {
    id: "2026-11-17",
    date: "November 17, 2026",
    title: "Unified Reporting Totals Across Spark",
    items: [
      "Your Dashboard, Campaign Report, shared links, and PDF exports all align on the same approved recap totals, keeping samples handed out cleanly separate from units sold.",
    ],
  },
  {
    id: "2026-11-16",
    date: "November 16, 2026",
    title: "Accurate Local Store Dates & Complete Schedules",
    items: [
      "Today, Schedule, and Calendar display every event on the local store date, no matter which time zone you're viewing from.",
      "Calendar and Upcoming views load your entire schedule in full with accurate daylight-saving event times.",
    ],
  },
  {
    id: "2026-11-15",
    date: "November 15, 2026",
    title: "Store Profiles, Shopper Themes, On-Shelf Summary & Plain-English Search",
    items: [
      "Dedicated Store Profiles: open any store from your Account Map, Reports, or recaps to view every visit, approved totals, products, shopper quotes, and field photos in one place.",
      "On-Shelf Summary & Shopper Insights: track on-shelf availability, price-tag visibility, shopper feedback themes, competitor mentions, and state-by-state top sellers across your Dashboard and Reports.",
      "Monthly Highlights & Worth a Look: spot your top-converting store of the month alongside automatic callouts for standout trends and regional activity.",
      "Plain-English Search & Chart Q&A: search recaps and requests naturally (like 'Texas Kroger events in October') or click Ask about this chart on any sampling graph.",
      "Smarter Maps & Faster Sign-In: sign in with Google, view clustered pins by store on your Account Map, and explore live daily events on the Today map.",
      "Best Photos First & Team Account Lists: Photos and Program Reports surface your strongest field shots first, charts track completed weeks cleanly, and uploaded account lists are shared across your entire team.",
    ],
  },
  {
    id: "2026-11-11",
    date: "November 11, 2026",
    title: "Light Mode, Custom Email Preferences & Activity History",
    items: [
      "Spark opens in crisp light mode by default — switch between Light and Dark anytime under Appearance in your account menu.",
      "Customize your Email Preferences to choose exactly which request updates, recap alerts, and digests you receive.",
      "Every request and event shows a clear activity history, and Program Reports include field photos, an activation map, and optional monthly email subscriptions.",
    ],
  },
  {
    id: "2026-11-10",
    date: "November 10, 2026",
    title: "Bulk Recap Approvals, Custom Report Ranges & Mobile Polish",
    items: [
      "Sign off on multiple recaps at once right from Approvals, and pick 30 days, 90 days, 6 months, year-to-date, or custom dates across Reports & ROI.",
      "Cleaner mobile navigation, clearer page titles, and larger, higher-contrast typography throughout Spark.",
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
