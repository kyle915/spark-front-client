/**
 * Spark v2 — Event detail view.
 *
 * Replaces the legacy EventCard (DaisyUI, duplicate Notes panel,
 * stacked daisy badges) with a focused Spark-chrome detail page.
 *
 * Layout principles:
 *   - One header: store name, one meta line (date, time, city, address),
 *     and the status chips once. Cancel, assign, and edit stay here.
 *   - Account & venue only shows facts the header does not (map link,
 *     timezone, the associated request, and anything else unique).
 *   - Contacts are one quiet row per person.
 *   - Empty roster and recaps are a single line. Filled states keep
 *     the real cards.
 *   - Notes shown once. Shift Replay stays below when GPS pings exist.
 *   - Back link respects history state, falls back to the Master Tracker.
 */

import RequestActivityTimeline from "@/requests/RequestActivityTimeline";
import { clientSafeBaName } from "@/utils/clientSafeBaName";
import React, { Suspense, useState } from "react";
import { displayBaCount } from "@/public/form/eventActivationSchedule";
import { useAdoptRecordTenant } from "@/hooks/useAdoptRecordTenant";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import AskAiButton from "@/components/ai/AskAiButton";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";

import { EventUuidQuery } from "@/api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@api/queries/__generated__/EventUuidQuery.graphql";
import ShiftReplayPanel from "@/requests/ShiftReplayPanel";
import EventAttendanceTable from "@/requests/EventAttendanceTable";
import EventMileagePanel from "@/requests/EventMileagePanel";
import InviteBAModal from "@/requests/InviteBAModal";
import CancelDemoDialog from "@/requests/CancelDemoDialog";
import { pickHeroImage } from "@/utils/recapFileUrl";

// Element id the header recap chip scrolls to when an event has >1 recap.
const RECAPS_SECTION_ID = "event-recaps";

type Event = NonNullable<EventUuidQueryType["response"]["event"]>;

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-orange",
  queue: "chip chip-gold",
  approved: "chip chip-lime",
  scheduled: "chip chip-sky",
  done: "chip chip-lime",
  declined: "chip chip-muted",
  cancelled: "chip chip-muted",
  canceled: "chip chip-muted",
};

const KNOWN_ACRONYMS = new Set([
  "BP",
  "KSP",
  "LLC",
  "USA",
  "IGA",
  "HEB",
  "ABC",
  "THC",
  "CBD",
]);

const cleanVenueTitle = (raw: string | null | undefined): string => {
  const stripped = (raw ?? "")
    .trim()
    .replace(/\s*[·•-]\s*\d{4}-\d{2}-\d{2}(?:\s*\(\d+\/\d+\))?\s*$/, "")
    .trim();
  if (!stripped) return "";
  return stripped
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      const core = token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
      if (core && KNOWN_ACRONYMS.has(core.toUpperCase())) {
        return token.replace(core, core.toUpperCase());
      }
      if (token === token.toLowerCase() && /[a-z]/.test(token)) {
        return token.replace(/[a-z]/, (c) => c.toUpperCase());
      }
      return token;
    })
    .join("");
};

const cleanDisplayNotes = (raw: string | null | undefined): string =>
  (raw ?? "")
    .replace(/(?:^|\n)\s*BA count:\s*\d+\s*(?=\n|$)/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const parseCalendarDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  const d = parseCalendarDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "—";
  const m = raw.match(/(?:^|T)(\d{2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (Number.isFinite(h)) {
      const meridiem = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${m[2]} ${meridiem}`;
    }
  }
  try {
    return new Date(raw).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const initials = (label: string) => {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// A recap can be a legacy `Recap` or a custom-template `CustomRecap`. The
// two share a chip on the Master Tracker but differ in shape, so we
// normalize each into this one card model and render a single grid below.
type RecapCard = {
  uuid: string;
  // Detail route — legacy and custom recaps live on different pages.
  viewPath: string;
  name: string | null;
  approved: boolean;
  createdAt: string | null;
  baName: string | null;
  totalEngagements: number | null;
  productsSold: number | null;
  hero: string | null;
  fileCount: number;
};

type LegacyRecap = NonNullable<NonNullable<Event["recaps"]>[number]>;
type CustomRecap = NonNullable<NonNullable<Event["customRecaps"]>[number]>;

const baNameFrom = (
  user: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

const normalizeLegacyRecap = (recap: LegacyRecap): RecapCard => ({
  uuid: String(recap.uuid),
  viewPath: `/recap/view/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  createdAt: recap.createdAt ?? null,
  baName: baNameFrom(recap.ambassador?.user),
  totalEngagements: recap.totalEngagements ?? null,
  productsSold: recap.productsSold ?? null,
  hero: pickHeroImage(recap.recapFiles ?? []),
  fileCount: (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  ).length,
});

const normalizeCustomRecap = (recap: CustomRecap): RecapCard => ({
  uuid: String(recap.uuid),
  // Custom recaps render on their own detail page (RecapCustomView).
  viewPath: `/recap/view-custom/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  createdAt: recap.createdAt ?? null,
  baName: baNameFrom(recap.ambassador?.user),
  totalEngagements: recap.totalEngagements ?? null,
  // CustomRecap exposes a single soldUnits count rather than productsSold.
  productsSold: recap.soldUnits ?? null,
  // CustomRecap precomputes a browser-renderable hero URL server-side; the
  // file list isn't fetched here, just its count.
  hero: recap.heroImageUrl ?? null,
  fileCount: recap.customRecapFilesCount ?? 0,
});

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <p
      className="mono text-[10px] mb-1"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-text-meta)",
      }}
    >
      {label}
    </p>
    <div
      className="text-sm"
      style={{ color: "var(--spark-text)" }}
    >
      {children}
    </div>
  </div>
);

const ContactLine: React.FC<{
  name: string;
  detail?: string | null;
  note?: string | null;
}> = ({ name, detail, note }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
    <span className="font-medium" style={{ color: "var(--spark-text)" }}>
      {name}
    </span>
    {detail ? (
      <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
        {detail}
      </span>
    ) : null}
    {note ? (
      <span
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.12em",
          color: "var(--spark-text-meta)",
        }}
      >
        {note}
      </span>
    ) : null}
  </div>
);

const Inner: React.FC<{ uuid: string; backTo: string }> = ({
  uuid,
  backTo,
}) => {
  const role = useSparkRole();
  const { tenantSlug } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const load = () => setRefreshKey((k) => k + 1);
  const data = useLazyLoadQuery<EventUuidQueryType>(
    EventUuidQuery,
    { uuid },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-and-network",
      fetchKey: refreshKey,
    },
  );
  const event = data.event as Event | null;
  // Deep link opened under another client → switch to the event's own.
  useAdoptRecordTenant(data.event?.tenant, "event");
  const [showAssign, setShowAssign] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!event) {
    return (
      <div
        className="spark-card p-10 text-center max-w-3xl"
        style={{ color: "var(--spark-text-meta)" }}
      >
        Event not found.
      </div>
    );
  }

  const req = event.request;
  const slug = (event.status?.name ?? req?.status?.name ?? "").toLowerCase();
  const reqSlug = (req?.status?.slug ?? req?.status?.name ?? "").toLowerCase();
  const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
  const venue =
    cleanVenueTitle(
      req?.retailer?.name ||
        event.retailer?.name ||
        req?.retailerName ||
        req?.name ||
        event.name,
    ) || "—";
  const displayTitle =
    cleanVenueTitle(event.name || req?.name) || venue || "Untitled event";
  const distributor =
    req?.distributor?.name?.trim() ||
    event.distributor?.name?.trim() ||
    req?.distributorName?.trim() ||
    null;
  const products = req?.products ?? [];
  const coBrands = req?.coBrands ?? [];
  const requestUuid = req?.uuid;
  const requestName = cleanVenueTitle(req?.name) || null;
  const eventTypeName =
    event.eventType?.name ?? req?.requestType?.name ?? "—";
  const scope = event.isNational ? "National" : "Local";
  const rawNotes = event.notes?.trim() || req?.notes?.trim() || "";
  const baCount = displayBaCount(req?.baCount, rawNotes);
  const notesText = cleanDisplayNotes(rawNotes);
  const hasNotes = Boolean(notesText);
  const market = req?.market?.trim() || null;
  const storeNumber = req?.storeNumber?.trim() || null;
  const billingEntityName = req?.billingEntity?.name?.trim() || null;
  const schedulingStatus = req?.schedulingStatus ?? null;
  const tz = event.timezone ?? req?.timezone ?? null;
  const rmmUser = event.rmmAsigned ?? req?.rmmAsigned ?? null;
  const rmmName = rmmUser
    ? [rmmUser.firstName, rmmUser.lastName].filter(Boolean).join(" ").trim()
    : "";
  const rmmEmail = req?.rmmAsigned?.email?.trim() || null;
  const requestorName =
    req?.client?.name?.trim() ||
    req?.clientName?.trim() ||
    [req?.createdBy?.firstName, req?.createdBy?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    req?.requestorEmail?.trim() ||
    req?.clientEmail?.trim() ||
    "—";
  const requestorEmail =
    req?.requestorEmail?.trim() ||
    req?.clientEmail?.trim() ||
    req?.client?.email?.trim() ||
    req?.createdBy?.email?.trim() ||
    null;
  const approvedByName = req?.approvedBy
    ? [req.approvedBy.firstName, req.approvedBy.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || req.approvedBy.email?.trim() || null
    : null;
  const approvedByEmail = req?.approvedBy?.email?.trim() || null;

  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const samePerson = (
    nameA: string | null | undefined,
    emailA: string | null | undefined,
    nameB: string | null | undefined,
    emailB: string | null | undefined,
  ): boolean => {
    if (emailA && emailB && norm(emailA) === norm(emailB)) return true;
    if (
      nameA &&
      nameB &&
      nameA !== "—" &&
      nameB !== "—" &&
      norm(nameA) === norm(nameB)
    )
      return true;
    return false;
  };
  const rmmSameAsRequestor = samePerson(
    requestorName,
    requestorEmail,
    rmmName,
    rmmEmail,
  );
  const approverSameAsRequestor = samePerson(
    requestorName,
    requestorEmail,
    approvedByName,
    approvedByEmail,
  );
  const approverSameAsRmm =
    !rmmSameAsRequestor &&
    samePerson(rmmName, rmmEmail, approvedByName, approvedByEmail);

  const firstStoreManager = (req?.storeManagers ?? [])[0] ?? null;
  const storeManagerName =
    req?.storeManagerName?.trim() || firstStoreManager?.name?.trim() || null;
  const storeManagerPhone =
    req?.storeManagerPhone?.trim() ||
    firstStoreManager?.phone?.trim() ||
    req?.retailerStoreContact?.trim() ||
    req?.retailer?.storeContact?.trim() ||
    null;
  const hasStoreManager = Boolean(storeManagerName || storeManagerPhone);
  const distributorEmail =
    req?.distributor?.email?.trim() || req?.distributorEmail?.trim() || null;
  const addressText = (
    event.address ??
    req?.address ??
    req?.retailerAddress ??
    ""
  ).trim();
  const primaryDateIso =
    event.startTime ?? req?.startTime ?? event.date ?? req?.date ?? null;
  const primaryDateLabel = fmtDate(primaryDateIso);
  const startRaw = event.startTime ?? req?.startTime ?? null;
  const endRaw = event.endTime ?? req?.endTime ?? null;
  const timeRangeLabel =
    startRaw && endRaw
      ? `${fmtTime(startRaw)} – ${fmtTime(endRaw)}`
      : startRaw
        ? fmtTime(startRaw)
        : null;

  const ambassadors = event.ambassadors ?? [];
  const confirmedCount = ambassadors.filter((a) => a.isApproved).length;
  const recaps: RecapCard[] = [
    ...(event.recaps ?? [])
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => normalizeLegacyRecap(r)),
    ...(event.customRecaps ?? [])
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => normalizeCustomRecap(r)),
  ];

  const isCancelledOrDeclined =
    ["cancelled", "canceled", "declined", "suspended"].includes(slug) ||
    ["cancelled", "canceled", "declined", "suspended"].includes(reqSlug);
  const hasApprovedRecap = recaps.some((r) => r.approved);
  const cancelTargetId = req?.id || req?.uuid || event.uuid;
  const canCancelEvent =
    Boolean(cancelTargetId) && !isCancelledOrDeclined && !hasApprovedRecap;
  const brandName =
    billingEntityName ||
    (tenantSlug ? cleanVenueTitle(tenantSlug.replace(/-/g, " ")) : null);

  const mapsHref = addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;
  const headerMeta = [
    primaryDateLabel !== "—" ? primaryDateLabel : null,
    timeRangeLabel,
    market,
    addressText && norm(addressText) !== norm(market ?? "") ? addressText : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const venueFacts: {
    key: string;
    label: string;
    wide?: boolean;
    value: React.ReactNode;
  }[] = [];
  if (venue !== "—" && norm(venue) !== norm(displayTitle)) {
    venueFacts.push({ key: "retailer", label: "RETAILER", value: venue });
  }
  if (storeNumber) {
    venueFacts.push({ key: "store", label: "STORE #", value: storeNumber });
  }
  if (mapsHref) {
    venueFacts.push({
      key: "map",
      label: "MAP",
      value: (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--spark-sky)", textDecoration: "none" }}
        >
          Open in Maps ↗
        </a>
      ),
    });
  }
  if (distributor) {
    venueFacts.push({
      key: "distributor",
      label: "DISTRIBUTOR",
      value: distributor,
    });
  }
  if (billingEntityName) {
    venueFacts.push({
      key: "billing",
      label: "BILLING ENTITY",
      value: billingEntityName,
    });
  }
  if (tz?.name) {
    venueFacts.push({
      key: "tz",
      label: "TIMEZONE",
      value: `${tz.name}${tz.code ? ` · ${tz.code}` : ""}`,
    });
  }
  if (baCount) {
    venueFacts.push({ key: "ba", label: "BA COUNT", value: baCount });
  }
  if (
    req?.isNonActiveProductRequired !== null &&
    req?.isNonActiveProductRequired !== undefined
  ) {
    venueFacts.push({
      key: "nonactive",
      label: "Is Non-Active Product Required?",
      value: req.isNonActiveProductRequired ? "Yes" : "No",
    });
  }
  if (req?.casesToBeShipped?.trim()) {
    venueFacts.push({
      key: "cases",
      label: "How many cases to be shipped?",
      value: req.casesToBeShipped.trim(),
    });
  }
  if (req?.accountSpendAmount?.trim()) {
    venueFacts.push({
      key: "spend",
      label: "Account Spend Amount",
      value: req.accountSpendAmount.trim(),
    });
  }
  if (req?.eventAssetsNeeded?.trim()) {
    venueFacts.push({
      key: "assets",
      label: "What assets are needed at this event?",
      wide: true,
      value: req.eventAssetsNeeded.trim(),
    });
  }
  if (req?.loadInTime?.trim()) {
    venueFacts.push({
      key: "loadin",
      label: "What time is Load-In",
      value: req.loadInTime.trim(),
    });
  }
  if (req?.onsitePoc?.trim()) {
    venueFacts.push({
      key: "poc",
      label: "Who is the onsite POC",
      value: req.onsitePoc.trim(),
    });
  }
  if (req?.additionalTeamDetails?.trim()) {
    venueFacts.push({
      key: "team",
      label: "Any additional details for the team to know?",
      wide: true,
      value: req.additionalTeamDetails.trim(),
    });
  }
  if (requestUuid) {
    venueFacts.push({
      key: "request",
      label: "ASSOCIATED REQUEST",
      value: (
        <Link
          to={`/request/view/${requestUuid}`}
          style={{ color: "var(--spark-sky)", textDecoration: "none" }}
        >
          {requestName ?? "View request →"}
        </Link>
      ),
    });
  }
  if (req?.createdAt) {
    venueFacts.push({
      key: "submitted",
      label: "SUBMITTED",
      value: `${fmtDate(req.createdAt)} · ${fmtTime(req.createdAt)}`,
    });
  }

  const contactLines: {
    key: string;
    name: string;
    detail: string | null;
    note: string | null;
  }[] = [];
  if ((requestorName && requestorName !== "—") || requestorEmail) {
    const notes = [
      rmmSameAsRequestor ? "Assigned RMM" : null,
      approverSameAsRequestor ? "Auto-approved" : null,
    ].filter((note): note is string => Boolean(note));
    contactLines.push({
      key: "requestor",
      name: requestorName !== "—" ? requestorName : (requestorEmail ?? "—"),
      detail:
        requestorEmail && requestorEmail !== requestorName
          ? requestorEmail
          : null,
      note: notes.length > 0 ? notes.join(" · ") : null,
    });
  }
  if (!rmmSameAsRequestor && (rmmName || rmmEmail)) {
    contactLines.push({
      key: "rmm",
      name: rmmName || rmmEmail || "—",
      detail: rmmEmail && rmmEmail !== rmmName ? rmmEmail : null,
      note: approverSameAsRmm ? "Assigned RMM · Approved" : "Assigned RMM",
    });
  }
  if (approvedByName && !approverSameAsRequestor && !approverSameAsRmm) {
    contactLines.push({
      key: "approver",
      name: approvedByName,
      detail:
        approvedByEmail && approvedByEmail !== approvedByName
          ? approvedByEmail
          : null,
      note: "Approved",
    });
  }
  if (hasStoreManager) {
    contactLines.push({
      key: "store-manager",
      name: storeManagerName || storeManagerPhone || "Store manager",
      detail:
        storeManagerPhone && storeManagerPhone !== storeManagerName
          ? storeManagerPhone
          : null,
      note: "Store manager",
    });
  }
  if (distributorEmail) {
    contactLines.push({
      key: "distributor-contact",
      name: distributorEmail,
      detail: null,
      note: "Distributor",
    });
  }

  const filedElsewhere = event.request?.recapsFiledCount ?? 0;
  const siblingEventUuid = event.request?.recapEventUuid ?? null;
  const recapLivesOnSibling =
    filedElsewhere > 0 &&
    Boolean(siblingEventUuid) &&
    siblingEventUuid !== event.uuid;

  const onRecapChip = () => {
    if (recaps.length === 1) {
      navigate(recaps[0].viewPath);
      return;
    }
    document
      .getElementById(RECAPS_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        to={backTo}
        className="mono text-[11px] inline-flex items-center gap-2 transition"
        style={{
          letterSpacing: "0.14em",
          color: "var(--spark-text-meta)",
          textDecoration: "none",
        }}
      >
        ← BACK
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              EVENT
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              {displayTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          <span className={chipClass}>
            ● {event.status?.name ?? req?.status?.name ?? "—"}
          </span>
          {eventTypeName !== "—" && (
            <span className="chip chip-sky">{eventTypeName}</span>
          )}
          <span className="chip chip-muted">
            {scope === "National" ? "◉ NATIONAL" : "⌖ LOCAL"}
          </span>
          {schedulingStatus === "already_scheduled" && (
            <span className="chip chip-lime">✓ SCHEDULED WITH ACCOUNT</span>
          )}
          {schedulingStatus === "needs_scheduling" && (
            <span className="chip chip-amber">◌ NEEDS SCHEDULING</span>
          )}
          {recaps.length > 0 && (
            <button
              type="button"
              onClick={onRecapChip}
              className="chip chip-lime"
              style={{ cursor: "pointer", border: "none" }}
              title={
                recaps.length === 1
                  ? "View recap"
                  : `View ${recaps.length} recaps`
              }
            >
              ● {recaps.length} RECAP{recaps.length === 1 ? "" : "S"}
            </button>
          )}
          {recaps.length === 0 &&
            (event.request?.recapsFiledCount ?? 0) > 0 &&
            event.request?.recapEventUuid &&
            event.request.recapEventUuid !== event.uuid && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/event/view/${event.request!.recapEventUuid}`, {
                    state: { from: location.pathname },
                  })
                }
                className="chip chip-lime"
                style={{ cursor: "pointer", border: "none" }}
                title="Recap filed on a linked shift for this request"
              >
                ● {event.request.recapsFiledCount} RECAP
                {(event.request.recapsFiledCount ?? 0) === 1 ? "" : "S"} ON
                LINKED SHIFT
              </button>
            )}
          {role.isAdmin && event.tenantId ? (
            <AskAiButton
              tenantId={String(event.tenantId)}
              scope="event"
              eventId={String(event.id)}
              subjectLabel={event.name ?? undefined}
            />
          ) : null}
          {role.isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                  border: "1px solid var(--spark-lime)",
                }}
              >
                ✚ Assign BA
              </button>
              <Link
                to={`/event/edit/${event.uuid}`}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  textDecoration: "none",
                }}
              >
                ✎ Edit
              </Link>
            </>
          )}
          {canCancelEvent && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-orange)",
                border: "1px solid rgba(239,90,42,0.4)",
              }}
            >
              Cancel event
            </button>
          )}
          </div>
        </div>
        {headerMeta ? (
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {headerMeta}
          </p>
        ) : null}
      </div>

      {/* Cancellation / decline reason banner */}
      {isCancelledOrDeclined && req?.declineReason && (
        <div
          className="spark-card p-5"
          style={{
            borderColor: "rgba(239,90,42,0.4)",
            background:
              "linear-gradient(180deg, rgba(239,90,42,0.08), transparent)",
          }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-orange)",
            }}
          >
            CANCELLATION / DECLINE REASON
          </p>
          <p
            className="text-sm italic"
            style={{ color: "var(--spark-text)", lineHeight: 1.55 }}
          >
            "{req.declineReason}"
          </p>
        </div>
      )}

      {venueFacts.length > 0 && (
        <div className="spark-card px-5 py-4">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ACCOUNT & VENUE
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {venueFacts.map((fact) => (
              <div
                key={fact.key}
                className={fact.wide ? "basis-full" : undefined}
              >
                <Field label={fact.label}>{fact.value}</Field>
              </div>
            ))}
          </div>
        </div>
      )}

      {contactLines.length > 0 && (
        <div className="spark-card px-5 py-4">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            CONTACTS
          </p>
          <div className="space-y-2">
            {contactLines.map((line) => (
              <ContactLine
                key={line.key}
                name={line.name}
                detail={line.detail}
                note={line.note}
              />
            ))}
          </div>
        </div>
      )}

      {/* Multi-brand co-activations */}
      {coBrands.length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-4"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            MULTI-BRAND ACTIVATION · +{coBrands.length}
          </p>
          <div className="space-y-4">
            {coBrands.map((cb) => (
              <div
                key={cb.tenantPk}
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.03)",
                  border: "1px solid var(--spark-border)",
                  borderRadius: 12,
                  padding: "0.75rem 1rem",
                }}
              >
                <p className="text-sm font-semibold">{cb.tenantName}</p>
                {cb.products.length > 0 && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    {cb.products.map((p) => p.name).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes (single source of truth — event notes or original request notes) */}
      {hasNotes && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            NOTES
          </p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--spark-text)" }}
          >
            {notesText}
          </p>
        </div>
      )}

      {/* Products */}
      {products.length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-4"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            PRODUCTS · {products.length}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) =>
              p ? (
                <div
                  key={p.id}
                  className="flex items-center gap-3"
                  style={{
                    background: "rgba(var(--spark-ink-rgb),0.03)",
                    border: "1px solid var(--spark-border)",
                    borderRadius: 12,
                    padding: "0.75rem",
                  }}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: "rgba(var(--spark-accent-rgb),0.10)",
                        color: "var(--spark-lime)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                      }}
                    >
                      ◇
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {p.name}
                    </p>
                    {p.productType?.name && (
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--spark-text-meta)" }}
                      >
                        {p.productType.name}
                      </p>
                    )}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Roster — a line when empty; cards only once people are assigned. */}
      {ambassadors.length === 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ROSTER · 0
          </p>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            No brand ambassadors assigned yet.
          </p>
          {role.isAdmin && (
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="text-xs font-semibold"
              style={{
                color: "var(--spark-lime)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Assign BA
            </button>
          )}
        </div>
      ) : (
        <div className="spark-card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              ROSTER · {ambassadors.length}
            </p>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-text-meta)",
              }}
            >
              {confirmedCount} CONFIRMED · {ambassadors.length - confirmedCount}{" "}
              INVITED
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ambassadors.map((a) => (
              <div
                key={a.uuid}
                className="flex items-center gap-3"
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.03)",
                  border: "1px solid var(--spark-border)",
                  borderRadius: 12,
                  padding: "0.75rem",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: a.isApproved
                      ? "rgba(var(--spark-accent-rgb),0.14)"
                      : "rgba(var(--spark-ink-rgb),0.06)",
                    color: a.isApproved
                      ? "var(--spark-lime)"
                      : "rgba(var(--spark-ink-rgb),0.55)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(
                    role.isClient
                      ? clientSafeBaName(a.name) || "Ambassador"
                      : a.name || a.email,
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {role.isClient
                      ? clientSafeBaName(a.name) || "Ambassador"
                      : a.name || a.email || "Unnamed BA"}
                  </p>
                  {role.isAdmin && a.email && (
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {a.email}
                    </p>
                  )}
                </div>
                <span
                  className={
                    a.isApproved ? "chip chip-lime" : "chip chip-muted"
                  }
                >
                  {a.isApproved ? "✓ Confirmed" : "◷ Invited"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recaps — a line when empty; cards once a report is filed.
          The header chip scrolls to this id. */}
      {recaps.length === 0 ? (
        <div
          id={RECAPS_SECTION_ID}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1"
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            RECAPS · 0
          </p>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            No recap filed on this event yet.
          </p>
          {recapLivesOnSibling && siblingEventUuid ? (
            <button
              type="button"
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-lime)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() =>
                navigate(`/event/view/${siblingEventUuid}`, {
                  state: { from: location.pathname },
                })
              }
            >
              {filedElsewhere} RECAP{filedElsewhere === 1 ? "" : "S"} ON LINKED
              SHIFT →
            </button>
          ) : requestUuid ? (
            <button
              type="button"
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-text-meta)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() =>
                navigate(`/request/view/${requestUuid}`, {
                  state: { from: location.pathname },
                })
              }
            >
              Open request field reports →
            </button>
          ) : null}
        </div>
      ) : (
        <div id={RECAPS_SECTION_ID} className="spark-card p-6">
          <p
            className="mono text-[10px] mb-4"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            RECAPS · {recaps.length}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recaps.map((recap) => {
              const { hero, baName, fileCount } = recap;
              return (
                <div
                  key={recap.uuid}
                  onClick={() => navigate(recap.viewPath)}
                  className="spark-card hov overflow-hidden cursor-pointer"
                >
                  <div
                    className="h-32 relative overflow-hidden"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 50%, rgba(var(--spark-accent-rgb),0.10), transparent 70%)",
                    }}
                  >
                    {hero ? (
                      <img
                        src={hero}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="text-3xl" aria-hidden>
                          ◈
                        </span>
                      </div>
                    )}
                    <span
                      className={`absolute top-2 right-2 chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
                    >
                      ● {recap.approved ? "APPROVED" : "DRAFT"}
                    </span>
                    {fileCount > 0 && (
                      <span
                        className="absolute bottom-2 left-2 mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: "rgba(var(--spark-accent-rgb),0.15)",
                          color: "var(--spark-lime)",
                          border: "1px solid rgba(var(--spark-accent-rgb),0.35)",
                        }}
                      >
                        ◉ {fileCount} FILE{fileCount === 1 ? "" : "S"}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p
                      className="font-bold text-sm truncate"
                      title={recap.name ?? displayTitle}
                    >
                      {cleanVenueTitle(recap.name) || displayTitle}
                    </p>
                    <p
                      className="mono text-[10px] uppercase mt-1 truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {baName ? `BY ${baName} · ` : ""}
                      {fmtDate(recap.createdAt ?? primaryDateIso)}
                    </p>
                    <div
                      className="mt-3 pt-3 grid grid-cols-2 gap-2 text-center"
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <div>
                        <p
                          className="tab-num text-base font-bold"
                          style={{ color: "var(--spark-lime)" }}
                        >
                          {recap.totalEngagements != null
                            ? recap.totalEngagements.toLocaleString()
                            : "—"}
                        </p>
                        <p className="label-mini">ENG</p>
                      </div>
                      <div>
                        <p className="tab-num text-base font-bold">
                          {recap.productsSold != null
                            ? recap.productsSold.toLocaleString()
                            : "—"}
                        </p>
                        <p className="label-mini">SOLD</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GPS trail and punches: Ignite staff only. A brand user never sees
          an ambassador's route, full name, punch coordinates or the punch
          editor. */}
      {role.isClient ? null : (
        <>
          <ShiftReplayPanel eventUuid={String(event.uuid)} />
          <EventAttendanceTable eventUuid={String(event.uuid)} />
        </>
      )}
      {role.isAdmin && <EventMileagePanel eventUuid={String(event.uuid)} />}
      {role.isAdmin && requestUuid ? (
        <RequestActivityTimeline requestUuid={String(requestUuid)} />
      ) : null}

      {/* Audit footer */}
      <div className="spark-card p-5">
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              EVENT UUID
            </p>
            <p
              className="mono text-xs"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {event.uuid}
            </p>
          </div>
          {event.coordinates && event.coordinates.length === 2 && (
            <div>
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-text-meta)",
                }}
              >
                COORDINATES
              </p>
              <a
                href={`https://www.google.com/maps?q=${event.coordinates[0]},${event.coordinates[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs"
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                {event.coordinates[0].toFixed(4)},{" "}
                {event.coordinates[1].toFixed(4)} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Assign-BA modal */}
      {showAssign && (
        <Suspense fallback={null}>
          <InviteBAModal
            eventId={String(event.id)}
            eventDate={event.date ?? event.startTime ?? null}
            eventAddress={event.address ?? null}
            onClose={() => setShowAssign(false)}
            onInvited={() => {
              setShowAssign(false);
              load();
            }}
          />
        </Suspense>
      )}

      {/* Cancel event modal */}
      <CancelDemoDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        requestId={cancelTargetId ? String(cancelTargetId) : null}
        storeName={displayTitle}
        dateLabel={primaryDateLabel !== "—" ? primaryDateLabel : null}
        brandName={brandName}
        onSent={() => load()}
      />
    </div>
  );
};

export default function SparkEventView() {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();
  const backTo =
    (location.state as { from?: string } | null)?.from ?? "/requests/list";

  if (!uuid) {
    return (
      <Layout>
        <div
          className="spark-card p-10 text-center max-w-3xl"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Event not found.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading event…
          </div>
        }
      >
        <Inner uuid={uuid} backTo={backTo} />
      </Suspense>
    </Layout>
  );
}
