# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally. Admin and client are treated as two products that share data, each with its own priorities.

- **Ignite ops staff** (admin.igniteproductions.co): staff ambassadors onto events, watch who is clocked in, review and approve recaps, close out hours for payroll, and answer client questions. They are in Spark all day, across many brands.
- **Brand clients** (client.igniteproductions.co): request activations, approve requests, and read results: recaps, photos and program numbers for their own brand. They visit occasionally and want the answer quickly.
- **Brand ambassadors** are not account holders. They reach Spark only through a per-brand web check-in link to clock in, clock out and file a recap.

## Product Purpose

Spark is Ignite Productions' platform for running field marketing: requests, events, staffing, time clock, recaps, photos, receipts, payroll hours and client reporting. It exists so Ignite can run many brand programs at once and show each client what happened, with evidence.

## Positioning

- **No app for ambassadors.** Clock-in and recaps happen on a web link per brand, with no download and no login.
- **Ignite approves first.** Clients see a recap, and the numbers it feeds, only after Ignite staff have reviewed and approved it.
- **Honest numbers.** No invented or blended metrics. Consumers sampled, reach and units sold stay separate, and conversion appears only where it applies (Retail and On-Premise, never Event activations).
- **One recap form per brand.** Each client has its own recap questions, photo categories and product list.

## Operating Context

- Admin runs on desktop during the working day; staff also check Today and On the Clock from a phone.
- Ambassadors use the check-in link on a phone, in a store or at an event, often on a poor connection.
- Clients arrive from an email (recap approved, request approved, weekly digest) and land on their brand's home or a single recap.
- Hours recorded in Spark are approved there and paid through Wingspan.
- Several brands mirror data to a Google Sheet the client already uses.

## Capabilities and Constraints

- Frontend: React 19, TypeScript, Vite, Tailwind 4, DaisyUI, Relay, Chart.js. Ships from `main` to Firebase Hosting (admin and client targets).
- Backend: `spark-api` (Django, Strawberry GraphQL), ships from `develop` to Cloud Run.
- One codebase serves admin and client; role decides what is shown.
- Client-facing screens never show ambassador full names or GPS.
- Terms in use: request, event, activation, recap, walk-up, standing code, RMM, BA (staff-facing only), tenant (internal; say "brand" or "client" in the UI).
- Pending walk-ups are excluded from KPIs and payroll until approved.

## Brand Commitments

- Name: Spark by Ignite. The wordmark does not change.
- Existing visual rules live in `DESIGN.md` and are binding for refinement work.
- Copy is plain and specific; orange is reserved for things that need someone.

## Evidence on Hand

- Live production data for every brand, through the GraphQL API.
- Real recap photos, receipts and program numbers per brand.
- No testimonials, benchmarks or pricing exist in the product; none should be invented.

## Product Principles

1. Show what needs a person before showing what is merely happening.
2. A number is shown only if it can be traced to approved recaps or real clock data.
3. Say the reason in words next to the item, not behind a count.
4. Staff and clients read the same facts; clients see the approved subset.
5. An empty state gives the next action or stays out of the way.
