# Claude Design prompt — Spark client FAQ (Liquid Death visual)

Copy everything below the line into Claude Design. Attach the PNGs listed in `README.md` (same folder). Desktop only.

---

Design a **client-facing Spark FAQ** for brand stakeholders who log in at **https://client.igniteproductions.co**.

This is a short branded FAQ booklet / one-pager series — PDF-ready and web-ready. Not a developer wiki. Not a Notion dump. Not a mobile FAQ. **Desktop only** (1440-wide product chrome). Do not design a phone layout, a responsive breakpoint system, or a mobile appendix.

## Audience

Brand clients on the Spark **client portal** — Liquid Death, Torch, Feel Free, Girl Beer, Krispy Krunchy, and other tenants. They are marketers and brand ops people reviewing sampling programs, recaps, and approvals.

They are **not** Brand Ambassadors in the field. They are **not** Ignite’s internal staffing/ops team.

Write in second person (“you”) as if speaking to a Liquid Death (or peer brand) client user. Product behavior in the Q&A applies to **all** brand clients. Visual language should match **Liquid Death’s Spark client chrome**.

## Visual source of truth

Use the attached screenshots as the only UI reference. Do not invent screens, nav items, or chrome that are not in the shots.

**Exemplar tenant: Liquid Death.** Match that client chrome:

- Dark ops product shell: near-black `#0a0d09`, lime `#c5f546`, orange `#ef5a2a`
- Type already in product: Space Grotesk + JetBrains Mono (no San Francisco, no Geist)
- Sidebar: Spark wordmark, **Liquid Death** tenant lockup (skull mark + name), sections Today / Recaps / Workspace / Outputs
- Client labels: **My Recaps**, Master Tracker, Account Map, Approvals, Insights, Reports
- Topbar: `spark.app / …`, lime **Public form** pill (`ighn-liquid-death` on LD), Jump, Logout
- Footer of sidebar: **CLIENT VIEW**
- If an **Admin / Client** toggle appears in any shot, ignore it — staff-only. Real clients never see it.

**Recaps are the exception:** the recap itself is a **white document** (Spark logo, not inverted) sitting inside the dark product. KPI numbers on the recap can pick up tenant green. Do not restyle recaps to dark ops chrome.

The login screen is a split desktop: dark form + lime “FIELD MARKETING, FINALLY” creative panel. Password + **Email me a sign-in link**.

The public request form (`/spark-form/ighn-liquid-death`) is dark chrome with the LD mark and a lime **Submit Request**.

The BA check-in shot (cream page, “Start your shift”) is **field-team only**. Do not use it as a hero or imply clients clock in there. One small callout is enough: BAs use a separate check-in link; clients review the recap after Ignite approves it.

## What Spark is (do not invent)

Spark by Ignite is the field-sampling / BA recap / campaign-ops portal Ignite runs for brand clients. Clients log in (password or magic link) at **client.igniteproductions.co**. Field links (check-in, request form, public recap share) are also minted on that host — never the admin host.

Support: **staffing@igniteproductions.co** · igniteproductions.co

## Exact sections and Q&A

Write real answers a brand client would ask week to week. Keep each answer short. Use the screenshots to illustrate, not to decorate every page.

### 1. How do I get in?

- URL: https://client.igniteproductions.co
- Sign in with the email Ignite provisioned (Google, email + password, or **Email me a sign-in link** — link expires in 30 minutes)
- Forgot password is on the same screen
- After login you land on your **client dashboard** (program this week, recap completion, items waiting on you)

### 2. Where do my recaps live?

- Sidebar → **My Recaps**
- The list **defaults to Approved** (last 30 days). That is the finished pile — the same recaps you can open, share, and download.
- It does **not** default to a separate “Shared” gate. If a recap is approved, it shows in My Recaps even if nobody has hit Share yet.
- Header reads like `RECAPS · APPROVED · 30D`. You can widen the date window (90D / All dates) or filter retailer / state / ambassador.
- Each row: venue, BA, date, Approved chip, engagement / sold / conversion, **Share**

### 3. Why don’t I see a recap yet?

- Clients **cannot see unapproved / draft custom recaps**. If the BA just filed and Ignite has not approved it, it will not appear in My Recaps.
- Empty 30-day window ≠ “nothing exists.” Try All dates, or email staffing if a specific store day is missing.
- Unapproved work is an Ignite review step, not a client draft inbox.

### 4. How do I read, download, and share a recap?

- Open a row → a **white** field-report document with the **Spark** logo and an **APPROVED** badge
- **Download PDF** and **Share** (copies a public link). The shared page is the same white document — no login required for the recipient.
- Photos, consumer engagement, feedback, products sampled, and a KPI strip (engagements / sold / conversion)
- **Your sign-off:** optional “Looks good” or “Need more photos” plus a note. This is client feedback on a published recap — it does not replace Ignite approval.

### 5. What is a 3rd Party Recap?

- Some programs let an external agency file a recap (no clock-in). Those recaps show a purple **3rd Party Recap** chip on the list and on the document.
- Same client rules: you only see it after it is approved. Sharing and PDF work the same.
- Do not treat this as Liquid Death–only. It is product behavior for any brand that uses an agency recap link.

### 6. How do I approve a new sampling request?

- Sidebar → **Approvals** (or dashboard **Needs review**)
- **Requests** tab: new activation requests for your brand. Approve to move into scheduling, or Decline with a note.
- **Recaps** tab: items still waiting on a recap sign-off, when your program uses that.
- This is not the same as My Recaps (approved documents).

### 7. What else can I see?

Keep these as a tight “around the portal” spread — one line each, LD chrome from the shots:

- **Dashboard** — this week, recap completion, needs review, program KPIs
- **Account Map** — pins + account list; schedule from the map; upload an account list
- **Reports** — “The numbers.” Events, consumers, brand awareness, purchase intent; Export PDF
- **Insights** — program KPIs, sentiment, geography
- **Master Tracker** — the full request/event list for your brand
- **Public form** pill in the topbar — your brand’s request-a-sampling link (LD: `https://client.igniteproductions.co/spark-form/ighn-liquid-death`)

### 8. How do I request a sampling?

- Use the **Public form** link (also shareable with distributors / field leads)
- LD title: **Liquid Death BA Request Form** — venue, dates/times, products, BA count → **Submit Request**
- Submissions route for approval (then scheduling). You will see new ones under Approvals → Requests.

### 9. What do Brand Ambassadors do vs what I see?

- BAs clock in and file the recap from a **field** check-in page (cream “Start your shift”), not from the dark client dashboard.
- Example field link pattern: `https://client.igniteproductions.co/checkin/LD-TNBJ8K` — label clearly as **field team**, not a client destination.
- You do not clock in. You review **approved** recaps, approve incoming requests, and read reports.

### 10. Who do I email?

- Program, staffing, missing recaps, access: **staffing@igniteproductions.co**
- Company site: igniteproductions.co

## Layout and craft

- High-end, sparse, booklet — think 6–10 desktop spreads, not an accordion wiki
- Dark ops cover + interior pages; **one white spread** reserved for “anatomy of a recap”
- Pull 2–4 screenshot crops as figures with short captions. Do not screenshot-dump every page
- Lime on dark for chrome; white + Spark mark for the recap figure
- No marketing liquid-metal / orb language from the public website. This is the **product** FAQ
- No Cursor, no agents, no internal bugs, no admin-only tools (On the Clock, Staffing Board, payroll, form builder)
- Do not mention Girl Beer email policy or any tenant-specific exception unless a client would see it in the UI
- Do not invent LD-only bugs or LD-only features. LD is the visual template; the Q&A is the shared client product

## Deliverable

A print-quality desktop FAQ (PDF/web). Title something like **Spark · Client FAQ**. Subtitle: for brand teams on client.igniteproductions.co. Footer: staffing@igniteproductions.co
