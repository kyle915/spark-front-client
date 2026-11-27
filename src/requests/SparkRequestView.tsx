import RequestActivityTimeline from "./RequestActivityTimeline";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useAdoptRecordTenant } from "@/hooks/useAdoptRecordTenant";
import { useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import AskAiButton from "@/components/ai/AskAiButton";
import LocationMap from "@shared/LocationMap";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import environment from "@/api/relay/environment";
import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";
import { RequestFieldReportsQuery } from "@api/queries/RequestFieldReportsQuery";
import type { RequestFieldReportsQuery as RequestFieldReportsQueryType } from "@api/queries/__generated__/RequestFieldReportsQuery.graphql";
import { UsersQuery } from "@api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import InternalNotesPanel from "./InternalNotesPanel";
import ShiftReplayPanel from "./ShiftReplayPanel";
import EventAttendanceTable from "./EventAttendanceTable";
import EventMileagePanel from "./EventMileagePanel";
import WalkupCodePanel from "./WalkupCodePanel";
import InviteBAModal from "./InviteBAModal";
import EventRosterPanel from "./EventRosterPanel";
import SmartStaffingPanel from "./SmartStaffingPanel";
import CancelDemoDialog from "./CancelDemoDialog";
import { pickHeroImage } from "@/utils/recapFileUrl";
import { displayBaCount } from "@/public/form/eventActivationSchedule";
import { recapTypeForRow, type RecapTypeKey } from "@/lib/activationBucket";
import { sumConversionBases } from "@/shared/sparkStat";

type Mentionable = { id: string; name: string; email: string };

// A recap can be a legacy `Recap` or a custom-template `CustomRecap`. They
// share the Master Tracker chip but differ in shape, so the Field Reports
// panel normalizes each into this one card model and renders a single grid.
type RecapCard = {
  uuid: string;
  // Detail route — legacy and custom recaps live on different pages.
  viewPath: string;
  name: string | null;
  approved: boolean;
  totalEngagements: number | null;
  productsSold: number | null;
  consumersSampled: number | null;
  isDryDemo: boolean;
  peopleEngaged: number | null;
  recapType: RecapTypeKey;
  // 3rd-party / agency recap: listed, but kept out of every total.
  excludeFromAggregates: boolean;
  baName: string | null;
  hero: string | null;
  fileCount: number;
};

type FieldReportsEvent = NonNullable<
  NonNullable<RequestFieldReportsQueryType["response"]["request"]>["events"]
>[number];
type LegacyRecap = NonNullable<
  NonNullable<FieldReportsEvent>["recaps"]
>[number];
type CustomRecap = NonNullable<
  NonNullable<FieldReportsEvent>["customRecaps"]
>[number];

const baNameFrom = (
  user: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

const normalizeLegacyRecap = (recap: NonNullable<LegacyRecap>): RecapCard => ({
  uuid: String(recap.uuid),
  viewPath: `/recap/view/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  totalEngagements: recap.totalEngagements ?? null,
  productsSold: recap.productsSold ?? null,
  consumersSampled: null,
  isDryDemo: false,
  peopleEngaged: null,
  recapType: recapTypeForRow(recap.recapType, null),
  excludeFromAggregates: false,
  baName: baNameFrom(recap.ambassador?.user),
  hero: pickHeroImage(recap.recapFiles ?? []),
  fileCount: (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  ).length,
});

const normalizeCustomRecap = (recap: NonNullable<CustomRecap>): RecapCard => ({
  uuid: String(recap.uuid),
  // Custom recaps render on their own detail page (RecapCustomView).
  viewPath: `/recap/view-custom/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  totalEngagements: recap.totalEngagements ?? null,
  // CustomRecap exposes a single soldUnits count rather than productsSold.
  productsSold: recap.soldUnits ?? null,
  consumersSampled: recap.consumersSampled ?? null,
  isDryDemo: Boolean(recap.isDryDemo),
  peopleEngaged: recap.peopleEngaged ?? null,
  recapType: recapTypeForRow(recap.recapType, null),
  excludeFromAggregates: Boolean(recap.excludeFromAggregates),
  baName: baNameFrom(recap.ambassador?.user),
  // CustomRecap precomputes a browser-renderable hero URL server-side; the
  // file list isn't fetched here, just its count.
  hero: recap.heroImageUrl ?? null,
  fileCount: recap.customRecapFilesCount ?? 0,
});

const LinkedSheetChipForView: React.FC = () => {
  const { tenantId } = useAuthStore();
  const url = (() => {
    if (!tenantId) return "";
    try {
      return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
    } catch {
      return "";
    }
  })();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
      style={{
        background: "rgba(95,184,239,0.10)",
        color: "var(--spark-sky)",
        border: "1px solid rgba(95,184,239,0.35)",
        textDecoration: "none",
      }}
      title="Open the brand's linked Google Sheet"
    >
      Sheet ↗
    </a>
  );
};

const MENTION_ROSTER_PAGE_SIZE = 100;

const NotesLoader: React.FC<{
  requestUuid: string;
  requestLabel: string;
}> = ({ requestUuid, requestLabel }) => {
  const { tenantId } = useAuthStore();
  // Memoised: a fresh object every render made the effect below re-run on
  // every render, and its state reset triggered the next render — an
  // endless loop that refetched UsersQuery and starved the rest of the page.
  const filters = useMemo(() => (tenantId ? { tenantId } : null), [tenantId]);
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters, first: MENTION_ROSTER_PAGE_SIZE },
    { fetchPolicy: "store-or-network" },
  );
  const [extraEdges, setExtraEdges] = useState<
    NonNullable<UsersQueryType["response"]["users"]>["edges"]
  >([]);

  // Cursor-walk remaining pages so @-mention roster is not silently
  // truncated at first:500 (People Load more pattern, auto-hydrate).
  useEffect(() => {
    let cancelled = false;
    const walk = async () => {
      let after = data?.users?.pageInfo?.endCursor ?? null;
      let hasNext = Boolean(data?.users?.pageInfo?.hasNextPage && after);
      type Edge = NonNullable<
        NonNullable<UsersQueryType["response"]["users"]>["edges"]
      >[number];
      const collected: Edge[] = [];
      let pages = 0;
      while (hasNext && after && pages < 20) {
        pages += 1;
        const next = await fetchQuery<UsersQueryType>(
          environment,
          UsersQuery,
          { filters, first: MENTION_ROSTER_PAGE_SIZE, after },
          { fetchPolicy: "network-only" },
        ).toPromise();
        if (cancelled) return;
        for (const edge of next?.users?.edges ?? []) {
          collected.push(edge);
        }
        after = next?.users?.pageInfo?.endCursor ?? null;
        hasNext = Boolean(next?.users?.pageInfo?.hasNextPage && after);
      }
      if (!cancelled && collected.length > 0) setExtraEdges(collected);
    };
    // Only reset when there is something to clear, so an unchanged empty
    // list does not schedule another render.
    setExtraEdges((prev) => (prev.length > 0 ? [] : prev));
    void walk();
    return () => {
      cancelled = true;
    };
  }, [data, filters]);

  // Build mention roster from real admin users so @-handles resolve
  // to actual emails for the notifyNoteMention fanout.
  const mentionables: Mentionable[] = useMemo(() => {
    const rows = [...(data?.users?.edges ?? []), ...extraEdges]
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    const seen = new Set<string>();
    return rows
      .filter((u) => {
        const role = (u.role?.name ?? "").toLowerCase();
        return role === "admin" || role === "spark-admin";
      })
      .map<Mentionable>((u) => ({
        id: String(u.id),
        name:
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.email ||
          "Admin",
        email: u.email ?? "",
      }))
      .filter((m) => {
        if (!m.email || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
  }, [data, extraEdges]);
  return (
    <InternalNotesPanel
      requestUuid={requestUuid}
      requestLabel={requestLabel}
      mentionables={mentionables}
    />
  );
};

/**
 * Spark v2 — Request detail view.
 *
 * Replaces the legacy /request/view/:uuid page (RequestCard.tsx,
 * 600+ lines of old-style chrome) with a focused Spark-chrome
 * detail that fits the rest of the v2 app — same dark card, mono
 * labels, status chips, and inline approve/decline actions.
 */

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
  if (!raw) return "";
  const m = raw.match(/(?:^|T)(\d{2}):(\d{2})/);
  if (!m) return raw;
  const h = parseInt(m[1], 10);
  if (!Number.isFinite(h)) return raw;
  const meridiem = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m[2]} ${meridiem}`;
};

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-orange",
  queue: "chip chip-gold",
  approved: "chip chip-purple",
  scheduled: "chip chip-sky",
  done: "chip chip-lime",
  declined: "chip chip-muted",
  cancelled: "chip chip-muted",
  canceled: "chip chip-muted",
};

type Request = NonNullable<RequestUuidQueryType["response"]["request"]>;

async function callApprovalMutation(
  mutation: "approveRequest" | "declineRequest",
  variables: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const inputType =
    mutation === "approveRequest" ? "ApproveRequestInput" : "DeclineRequestInput";
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({
      query: `
        mutation Run($input: ${inputType}!) {
          ${mutation}(input: $input) {
            success
            message
          }
        }
      `,
      variables,
    }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    return {
      success: false,
      message: json.errors.map((e: { message: string }) => e.message).join("; "),
    };
  }
  const r = json?.data?.[mutation];
  return {
    success: Boolean(r?.success),
    message: r?.message ?? "",
  };
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
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

const Inner: React.FC<{ uuid: string; from: string }> = ({ uuid, from }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const { tenantSlug } = useAuthStore();
  const role = useSparkRole();
  const [refreshKey, setRefreshKey] = useState(0);
  const load = () => setRefreshKey((k) => k + 1);
  const data = useLazyLoadQuery<RequestUuidQueryType>(
    RequestUuidQuery,
    { uuid },
    {
      // Cold open: serve the Relay store when warm (e.g. navigated from
      // the tracker) instead of refetching; explicit refresh (load())
      // still goes network-only via refreshKey / fetchKey.
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: refreshKey,
    },
  );
  const request = data.request as Request | null;
  // Deep link opened under another client → switch to the request's own.
  useAdoptRecordTenant(data.request?.tenant, "request");

  const [busy, setBusy] = useState(false);
  const [decliningOpen, setDecliningOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const firstEvent = (request?.events ?? []).find(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );
  const eventForInvite = (firstEvent?.id as string | undefined) ?? null;
  const eventForInviteDate =
    (firstEvent?.date as string | undefined | null) ?? null;
  const eventForInviteAddress =
    (firstEvent?.address as string | undefined | null) ?? null;

  if (!request) {
    return (
      <div
        className="spark-card p-10 text-center max-w-3xl"
        style={{ color: "var(--spark-text-meta)" }}
      >
        Request not found.
      </div>
    );
  }

  const slug = (request.status?.slug ?? request.status?.name ?? "")
    .toString()
    .toLowerCase();
  const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
  const reqId = `REQ-${String(request.id).slice(-4).toUpperCase()}`;
  const venue =
    cleanVenueTitle(
      request.retailer?.name || request.retailerName || request.name,
    ) || "—";
  const market = request.market?.trim() || null;
  const fullAddress = (() => {
    const street = (
      request.address ||
      request.retailerAddress ||
      request.retailer?.address ||
      ""
    ).trim();
    if (street && /\b\d{5}\b/.test(street)) return street;
    const tail = (request.market ?? "").split(", ").filter(
      (p) => p && !street.toLowerCase().includes(p.toLowerCase()),
    );
    return [street, ...tail].filter(Boolean).join(", ");
  })();
  const requestorName =
    request.client?.name?.trim() ||
    request.clientName?.trim() ||
    [request.createdBy?.firstName, request.createdBy?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    request.requestorEmail ||
    request.clientEmail ||
    "—";
  const requestorEmail =
    request.requestorEmail?.trim() ||
    request.clientEmail?.trim() ||
    request.client?.email?.trim() ||
    request.createdBy?.email?.trim() ||
    null;
  const approverName =
    [request.approvedBy?.firstName, request.approvedBy?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    request.approvedBy?.email?.trim() ||
    null;
  const approverEmail = request.approvedBy?.email?.trim() || null;
  const rmmName = request.rmmAsigned
    ? [request.rmmAsigned.firstName, request.rmmAsigned.lastName]
        .filter(Boolean)
        .join(" ")
        .trim()
    : "";
  const rmmEmail = request.rmmAsigned?.email?.trim() || null;

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
    approverName,
    approverEmail,
  );
  const approverSameAsRmm =
    !rmmSameAsRequestor &&
    samePerson(rmmName, rmmEmail, approverName, approverEmail);

  const distributorName =
    request.distributor?.name?.trim() ||
    request.distributorName?.trim() ||
    null;
  const distributorEmail =
    request.distributor?.email?.trim() ||
    request.distributorEmail?.trim() ||
    null;
  const firstStoreManager = (request.storeManagers ?? [])[0] ?? null;
  const storeManagerName =
    request.storeManagerName?.trim() ||
    firstStoreManager?.name?.trim() ||
    null;
  const storeManagerPhone =
    request.storeManagerPhone?.trim() ||
    firstStoreManager?.phone?.trim() ||
    request.retailer?.storeContact?.trim() ||
    request.retailerStoreContact?.trim() ||
    null;
  const hasStoreManager = Boolean(storeManagerName || storeManagerPhone);
  const rawNotes = request.notes?.trim() || "";
  const baCount = displayBaCount(request.baCount, rawNotes);
  const notesText = cleanDisplayNotes(rawNotes);
  const primaryDateIso = request.startTime ?? request.date ?? null;
  const primaryDateLabel = fmtDate(primaryDateIso);
  const timeRangeLabel =
    request.startTime && request.endTime
      ? `${fmtTime(request.startTime)} – ${fmtTime(request.endTime)}`
      : request.startTime
        ? fmtTime(request.startTime)
        : null;
  const scope = request.retailer?.isNational ? "National" : "Local";
  const mapsHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  const headerMeta = [
    primaryDateLabel !== "—" ? primaryDateLabel : null,
    timeRangeLabel,
    market,
    fullAddress && norm(fullAddress) !== norm(market ?? "") ? fullAddress : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const spawnedEvents = (request.events ?? []).filter(
    (e): e is NonNullable<typeof e> => Boolean(e?.uuid),
  );

  const venueFacts: {
    key: string;
    label: string;
    wide?: boolean;
    value: React.ReactNode;
  }[] = [];
  if (request.storeNumber?.trim()) {
    venueFacts.push({
      key: "store",
      label: "STORE #",
      value: request.storeNumber.trim(),
    });
  }
  if (distributorName) {
    venueFacts.push({
      key: "distributor",
      label: "DISTRIBUTOR",
      value: distributorName,
    });
  }
  if (request.billingEntity?.name?.trim()) {
    venueFacts.push({
      key: "billing",
      label: "BILLING ENTITY",
      value: request.billingEntity.name.trim(),
    });
  }
  if (request.timezone?.name) {
    venueFacts.push({
      key: "tz",
      label: "TIMEZONE",
      value: `${request.timezone.name}${request.timezone.code ? ` · ${request.timezone.code}` : ""}`,
    });
  }
  if (baCount) {
    venueFacts.push({ key: "ba", label: "BA COUNT", value: baCount });
  }
  if (request.isNonActiveProductRequired != null) {
    venueFacts.push({
      key: "nonactive",
      label: "Is Non-Active Product Required?",
      value: request.isNonActiveProductRequired ? "Yes" : "No",
    });
  }
  if (request.casesToBeShipped?.trim()) {
    venueFacts.push({
      key: "cases",
      label: "How many cases to be shipped?",
      value: request.casesToBeShipped.trim(),
    });
  }
  if (request.accountSpendAmount?.trim()) {
    venueFacts.push({
      key: "spend",
      label: "Account Spend Amount",
      value: request.accountSpendAmount.trim(),
    });
  }
  if (request.eventAssetsNeeded?.trim()) {
    venueFacts.push({
      key: "assets",
      label: "What assets are needed at this event?",
      wide: true,
      value: request.eventAssetsNeeded.trim(),
    });
  }
  if (request.loadInTime?.trim()) {
    venueFacts.push({
      key: "loadin",
      label: "What time is Load-In",
      value: request.loadInTime.trim(),
    });
  }
  if (request.onsitePoc?.trim()) {
    venueFacts.push({
      key: "poc",
      label: "Who is the onsite POC",
      value: request.onsitePoc.trim(),
    });
  }
  if (request.additionalTeamDetails?.trim()) {
    venueFacts.push({
      key: "team",
      label: "Any additional details for the team to know?",
      wide: true,
      value: request.additionalTeamDetails.trim(),
    });
  }
  if (spawnedEvents.length > 0) {
    venueFacts.push({
      key: "events",
      label:
        spawnedEvents.length === 1
          ? "SPAWNED EVENT"
          : `SPAWNED EVENTS · ${spawnedEvents.length}`,
      value: (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {spawnedEvents.map((ev, idx) => {
            const evLabel =
              cleanVenueTitle(ev.name) ||
              (ev.startTime ?? ev.date ? fmtDate(ev.startTime ?? ev.date) : null) ||
              (spawnedEvents.length === 1 ? "View event" : `Event ${idx + 1}`);
            return (
              <Link
                key={String(ev.uuid)}
                to={`/event/view/${ev.uuid}`}
                state={{ from: `/request/view/${request.uuid}` }}
                style={{ color: "var(--spark-sky)", textDecoration: "none" }}
              >
                {evLabel} →
              </Link>
            );
          })}
        </div>
      ),
    });
  }
  if (request.createdAt) {
    const createdTime = fmtTime(request.createdAt);
    venueFacts.push({
      key: "submitted",
      label: "SUBMITTED",
      value: `${fmtDate(request.createdAt)}${createdTime ? ` · ${createdTime}` : ""}`,
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
  if (approverName && !approverSameAsRequestor && !approverSameAsRmm) {
    contactLines.push({
      key: "approver",
      name: approverName,
      detail:
        approverEmail && approverEmail !== approverName
          ? approverEmail
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
  const approverShownInContacts = Boolean(
    approverName &&
      (approverSameAsRequestor || approverSameAsRmm || contactLines.some((c) => c.key === "approver")),
  );

  const canApprove = slug === "pending";
  const canDecline = !role.isClient && slug === "pending";
  const isCancelledOrDeclined = [
    "declined",
    "cancelled",
    "canceled",
    "suspended",
    "done",
  ].includes(slug);
  const hasApprovedRecap = (request.events ?? []).some(
    (ev) =>
      (ev?.recaps ?? []).some((r) => r?.approved) ||
      (ev?.customRecaps ?? []).some((r) => r?.approved),
  );
  const canCancelEvent = !isCancelledOrDeclined && !hasApprovedRecap;
  const brandName =
    request.billingEntity?.name?.trim() ||
    (tenantSlug ? cleanVenueTitle(tenantSlug.replace(/-/g, " ")) : null);

  const confirmApprove = async () => {
    setBusy(true);
    try {
      const result = await callApprovalMutation("approveRequest", {
        input: { id: request.id },
      });
      if (!result.success) throw new Error(result.message || "Approve failed.");
      showAlert(`Approved ${reqId} — event queued for staffing.`, "success");
      setApproveOpen(false);
      load();
    } catch (e) {
      showAlert(`Couldn't approve: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitDecline = async () => {
    if (declineReason.trim().length < 8) {
      showAlert(
        "Tell the requestor at least a sentence about why.",
        "warning",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await callApprovalMutation("declineRequest", {
        input: { id: request.id, declineReason: declineReason.trim() },
      });
      if (!result.success) throw new Error(result.message || "Decline failed.");
      showAlert(`Declined ${reqId} — requestor notified.`, "success");
      setDecliningOpen(false);
      setDeclineReason("");
      load();
    } catch (e) {
      showAlert(`Couldn't decline: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              {reqId}
            </span>
            <span className={chipClass}>
              {(request.status?.name ?? slug).toUpperCase()}
            </span>
            {request.requestType?.name && (
              <span className="chip chip-sky">
                {request.requestType.name.toUpperCase()}
              </span>
            )}
            <span className="chip chip-muted">
              {scope === "National" ? "◉ NATIONAL" : "⌖ LOCAL"}
            </span>
            {request.schedulingStatus === "already_scheduled" && (
              <span className="chip chip-lime">✓ SCHEDULED WITH ACCOUNT</span>
            )}
            {request.schedulingStatus === "needs_scheduling" && (
              <span className="chip chip-amber">◌ NEEDS SCHEDULING</span>
            )}
          </div>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {venue}
          </h1>
          {(headerMeta || mapsHref) && (
            <p
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {headerMeta ? <span>{headerMeta}</span> : null}
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-[10px] px-2 py-0.5 rounded-md transition"
                  style={{
                    letterSpacing: "0.1em",
                    color: "var(--spark-sky)",
                    background: "rgba(95,184,239,0.1)",
                    border: "1px solid rgba(95,184,239,0.3)",
                    textDecoration: "none",
                  }}
                >
                  Open in Maps ↗
                </a>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LinkedSheetChipForView />
          <button
            onClick={() => navigate(from)}
            className="mono text-[10px] px-3 py-2 rounded-xl"
            style={{
              letterSpacing: "0.18em",
              background: "rgba(var(--spark-ink-rgb),0.04)",
              color: "var(--spark-text-secondary)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ← BACK
          </button>
        </div>
      </div>

      {/* Decline / cancellation reason banner */}
      {(slug === "declined" || slug === "cancelled" || slug === "canceled") &&
        request.declineReason && (
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
              "{request.declineReason}"
            </p>
            {approverName && (
              <p
                className="mono text-[10px] mt-2"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-text-meta)",
                }}
              >
                — {approverName}
              </p>
            )}
          </div>
        )}

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-2">
        {role.isAdmin && request.tenantId
          ? (request.events ?? [])
              .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev?.id))
              .map((ev) => (
                <AskAiButton
                  key={String(ev.id)}
                  tenantId={String(request.tenant?.id ?? request.tenantId)}
                  scope="event"
                  eventId={String(ev.id)}
                  subjectLabel={ev.name || "this event"}
                  label={
                    (request.events ?? []).filter(Boolean).length > 1
                      ? `Ask Spark · ${ev.name || "event"}`
                      : undefined
                  }
                />
              ))
          : null}
        {canApprove && (
          <button
            onClick={() => setApproveOpen(true)}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✓ Approve
          </button>
        )}
        {canDecline && (
          <button
            onClick={() => setDecliningOpen(true)}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-orange)",
              border: "1px solid rgba(239,90,42,0.4)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✗ Decline
          </button>
        )}
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (venue && venue !== "—") params.set("venue", venue);
            if (request.address) params.set("address", request.address);
            if (request.startTime) {
              const m = request.startTime.match(/(?:^|T)(\d{2}):(\d{2})/);
              if (m) {
                params.set("startTime", `${m[1]}:${m[2]}`);
              } else {
                try {
                  const d = new Date(request.startTime);
                  params.set(
                    "startTime",
                    `${String(d.getHours()).padStart(2, "0")}:${String(
                      d.getMinutes(),
                    ).padStart(2, "0")}`,
                  );
                } catch {
                  /* fall through */
                }
              }
            }
            if (request.endTime) {
              const m = request.endTime.match(/(?:^|T)(\d{2}):(\d{2})/);
              if (m) {
                params.set("endTime", `${m[1]}:${m[2]}`);
              } else {
                try {
                  const d = new Date(request.endTime);
                  params.set(
                    "endTime",
                    `${String(d.getHours()).padStart(2, "0")}:${String(
                      d.getMinutes(),
                    ).padStart(2, "0")}`,
                  );
                } catch {
                  /* fall through */
                }
              }
            }
            if (request.requestType?.id)
              params.set("requestTypeId", String(request.requestType.id));
            if (request.timezone?.id)
              params.set("timezoneId", String(request.timezone.id));
            if (request.distributor?.id)
              params.set("distributorId", String(request.distributor.id));
            if (request.schedulingStatus)
              params.set("schedulingStatus", request.schedulingStatus);
            if (request.isNonActiveProductRequired != null)
              params.set(
                "isNonActiveProductRequired",
                request.isNonActiveProductRequired ? "yes" : "no",
              );
            if (request.casesToBeShipped)
              params.set("casesToBeShipped", request.casesToBeShipped);
            if (request.accountSpendAmount)
              params.set("accountSpendAmount", request.accountSpendAmount);
            if (request.eventAssetsNeeded)
              params.set("eventAssetsNeeded", request.eventAssetsNeeded);
            if (request.loadInTime) params.set("loadInTime", request.loadInTime);
            if (request.onsitePoc) params.set("onsitePoc", request.onsitePoc);
            if (request.additionalTeamDetails)
              params.set("additionalTeamDetails", request.additionalTeamDetails);
            if (notesText) params.set("notes", notesText);
            const productIds = (request.products ?? [])
              .map((p) => (p ? String(p.id) : ""))
              .filter(Boolean)
              .join(",");
            if (productIds) params.set("productIds", productIds);
            navigate(`/requests/create?${params.toString()}`);
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-sky)",
            border: "1px solid rgba(95,184,239,0.4)",
          }}
          title="Pre-fill the create form with this request's setup — pick a new date."
        >
          ⎘ Duplicate
        </button>
        <button
          onClick={() => navigate(`/request/edit/${request.uuid}`)}
          className="px-4 py-2 rounded-xl text-sm"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ✎ Edit
        </button>
        <button
          onClick={() => navigate(`/report-view/${request.uuid}`)}
          className="px-4 py-2 rounded-xl text-sm"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
          title="Open this request's branded campaign report — KPIs, gallery, map, BA roster"
        >
          Report
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-sm"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
          title="Print or save-as-PDF a clean brief sheet for the BA to take to the venue"
        >
          Print brief
        </button>
        {role.isAdmin && eventForInvite && (
          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
            title="Invite a brand ambassador to this shift — they'll get a push on their phone"
          >
            ✦ Invite BA
          </button>
        )}
        {canCancelEvent && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
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

      {inviteOpen && eventForInvite && (
        <InviteBAModal
          eventId={eventForInvite}
          eventDate={eventForInviteDate}
          eventAddress={eventForInviteAddress}
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            load();
          }}
        />
      )}

      {/* Details grid — only unique facts not already in the header */}
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

      {/* Venue map — only when coordinates are on the request */}
      {request.coordinates &&
        request.coordinates.length === 2 &&
        Number.isFinite(Number(request.coordinates[0])) &&
        Number.isFinite(Number(request.coordinates[1])) && (
          <div
            className="spark-card overflow-hidden"
            style={{ height: 280 }}
          >
            <LocationMap
              coordinates={request.coordinates as readonly number[]}
              label={venue}
              address={request.address ?? undefined}
              zoom={15}
            />
          </div>
        )}

      {/* Contacts — compact quiet rows */}
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

      {/* Notes */}
      {notesText && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-2"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-gold)",
            }}
          >
            NOTES
          </p>
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ color: "var(--spark-text)", lineHeight: 1.6 }}
          >
            {notesText}
          </p>
        </div>
      )}

      {/* Products */}
      {request.products && request.products.length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            PRODUCTS · {request.products.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {request.products.map((p) => (
              <div
                key={p.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.025)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name ?? ""}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div
                    className="w-full aspect-square grid place-items-center"
                    style={{
                      background: "rgba(var(--spark-ink-rgb),0.04)",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    ◈
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold leading-tight truncate">
                    {p.name ?? "—"}
                  </p>
                  {p.productType?.name && (
                    <p
                      className="mono text-[9px] mt-0.5"
                      style={{
                        letterSpacing: "0.16em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {p.productType.name.toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {request.coBrands && request.coBrands.length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
          >
            MULTI-BRAND ACTIVATION · {request.coBrands.length + 1} BRANDS
          </p>
          <ul className="space-y-2">
            {request.coBrands.map((cb) => (
              <li key={cb.tenantPk} className="text-sm">
                <span className="font-semibold">{cb.tenantName}</span>
                <span style={{ color: "var(--spark-text-meta)" }}>
                  {" · "}
                  {cb.products.map((p) => p.name).filter(Boolean).join(", ") || "No SKUs"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Internal notes + @-mention */}
      <Suspense
        fallback={
          <div
            className="spark-card p-5 text-sm"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading notes…
          </div>
        }
      >
        <NotesLoader
          requestUuid={String(request.uuid)}
          requestLabel={reqId}
        />
      </Suspense>

      {/* Smart staffing + Roster — per event, admin-only */}
      {role.isAdmin &&
        (request.events ?? [])
          .filter((e): e is NonNullable<typeof e> => Boolean(e))
          .map((ev) => (
            <Fragment key={`staffing-${String(ev.uuid)}`}>
              <SmartStaffingPanel
                eventId={String(ev.id)}
                eventLabel={String(ev.name ?? ev.uuid ?? "shift")}
              />
              <EventRosterPanel
                eventId={String(ev.id)}
                eventLabel={String(ev.name ?? ev.uuid ?? "shift")}
              />
            </Fragment>
          ))}

      {/* Field reports — lazy recap/file tree in its own Suspense so
          the header/account sections above paint first. */}
      <Suspense
        fallback={
          <div
            className="spark-card p-5 text-sm"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading field reports…
          </div>
        }
      >
        <FieldReportsLoader requestUuid={String(request.uuid)} />
      </Suspense>

      {/* Who did what, when — staff only (it names people). */}
      {role.isAdmin && (
        <RequestActivityTimeline requestUuid={uuid} />
      )}

      {/* Shift Replay */}
      {(request.events ?? [])
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((ev) => (
          <div key={String(ev.uuid)} className="space-y-4">
            {/* Ignite staff only: an ambassador's route, full name, punch
                coordinates and the punch editor are never shown to a brand. */}
            {role.isClient ? null : (
              <>
                <ShiftReplayPanel eventUuid={String(ev.uuid)} />
                <EventAttendanceTable eventUuid={String(ev.uuid)} />
              </>
            )}
            {role.isAdmin && <EventMileagePanel eventUuid={String(ev.uuid)} />}
            {role.isAdmin && <WalkupCodePanel eventUuid={String(ev.uuid)} />}
          </div>
        ))}

      {/* Audit footer */}
      <div className="spark-card p-5">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              CREATED
            </p>
            <p style={{ color: "var(--spark-text-secondary)" }}>
              {fmtDate(request.createdAt)}
            </p>
          </div>
          {slug === "approved" && !approverShownInContacts && approverName && (
            <div>
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                }}
              >
                APPROVED
              </p>
              <p style={{ color: "var(--spark-text-secondary)" }}>
                {fmtDate(request.updatedAt)} by {approverName}
              </p>
            </div>
          )}
          {(slug === "declined" ||
            slug === "cancelled" ||
            slug === "canceled") && (
            <div>
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-orange)",
                }}
              >
                {slug === "declined" ? "DECLINED" : "CANCELLED"}
              </p>
              <p style={{ color: "var(--spark-text-secondary)" }}>
                {fmtDate(request.updatedAt)}
                {approverName && !approverShownInContacts ? ` by ${approverName}` : ""}
              </p>
            </div>
          )}
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              LAST UPDATED
            </p>
            <p style={{ color: "var(--spark-text-secondary)" }}>
              {fmtDate(request.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Approve confirm modal */}
      {approveOpen && (
        <div
          onClick={() => !busy && setApproveOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(var(--spark-bg-rgb),0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              APPROVE REQUEST
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Approve {reqId}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              <strong>{venue}</strong>
              {market ? ` · ${market}` : ""}
              {primaryDateLabel !== "—" ? ` · ${primaryDateLabel}` : ""}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => !busy && setApproveOpen(false)}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-text-meta)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmApprove}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? "Approving…" : "✓ Approve + notify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline modal */}
      {decliningOpen && (
        <div
          onClick={() => !busy && setDecliningOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(var(--spark-bg-rgb),0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              DECLINE REQUEST
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Why are you declining {reqId}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              This goes to <strong>{requestorName}</strong> in the decline
              email so they can revise.
            </p>
            <textarea
              autoFocus
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              placeholder="e.g., We don't have inventory in this market until Q3."
              className="w-full mt-4 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.14em",
                color:
                  declineReason.trim().length < 8
                    ? "var(--spark-orange)"
                    : "rgba(var(--spark-ink-rgb),0.45)",
              }}
            >
              {declineReason.trim().length < 8
                ? "AT LEAST A SENTENCE — REQUIRED"
                : `${declineReason.trim().length} CHARS`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => !busy && setDecliningOpen(false)}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-text-meta)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={submitDecline}
                disabled={busy || declineReason.trim().length < 8}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "var(--spark-on-accent)",
                  opacity: busy || declineReason.trim().length < 8 ? 0.5 : 1,
                }}
              >
                {busy ? "Sending…" : "Decline + send comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel event modal */}
      <CancelDemoDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        requestId={String(request.id || request.uuid)}
        storeName={venue !== "—" ? venue : null}
        dateLabel={primaryDateLabel !== "—" ? primaryDateLabel : null}
        brandName={brandName}
        onSent={() => load()}
      />
    </div>
  );
};

// Field Reports — every recap submitted against the events on this
// request. Fetched by a separate lazy query (RequestFieldReportsQuery)
// so the fat recap/recapFiles tree never blocks the request header.
type FieldReportsRequest = NonNullable<
  RequestFieldReportsQueryType["response"]["request"]
>;

const FieldReportsLoader: React.FC<{ requestUuid: string }> = ({
  requestUuid,
}) => {
  const data = useLazyLoadQuery<RequestFieldReportsQueryType>(
    RequestFieldReportsQuery,
    { uuid: requestUuid },
    { fetchPolicy: "store-or-network" },
  );
  if (!data.request) return null;
  return <FieldReportsPanel request={data.request} />;
};

const FieldReportsPanel: React.FC<{ request: FieldReportsRequest }> = ({
  request,
}) => {
  const navigate = useNavigate();
  const events = (request.events ?? []).filter(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );

  type Row = {
    eventName: string | null;
    eventDate: string | null;
    recap: RecapCard;
  };
  const rows: Row[] = [];
  const awaiting: { uuid: string; name: string; date: string | null }[] = [];
  for (const ev of events) {
    const legacy = (ev.recaps ?? []).filter(
      (r): r is NonNullable<typeof r> => Boolean(r),
    );
    const custom = (ev.customRecaps ?? []).filter(
      (r): r is NonNullable<typeof r> => Boolean(r),
    );
    if (legacy.length === 0 && custom.length === 0) {
      awaiting.push({
        uuid: String(ev.uuid),
        name: cleanVenueTitle(ev.name) || "Untitled event",
        date: ev.startTime ?? ev.date ?? null,
      });
      continue;
    }
    for (const r of legacy) {
      rows.push({
        eventName: cleanVenueTitle(ev.name) || null,
        eventDate: ev.startTime ?? ev.date ?? null,
        recap: normalizeLegacyRecap(r),
      });
    }
    for (const r of custom) {
      rows.push({
        eventName: cleanVenueTitle(ev.name) || null,
        eventDate: ev.startTime ?? ev.date ?? null,
        recap: normalizeCustomRecap(r),
      });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          FIELD REPORTS · 0
        </p>
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          No recap filed on this request yet.
        </p>
        {awaiting.length > 0 && (
          <Link
            to={`/event/view/${awaiting[0].uuid}`}
            state={{ from: `/request/view/${request.uuid}` }}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.12em",
              color: "var(--spark-text-meta)",
              textDecoration: "none",
            }}
          >
            {awaiting.length === 1
              ? `Open event (${awaiting[0].name}) →`
              : `Open first of ${awaiting.length} events awaiting recap →`}
          </Link>
        )}
      </div>
    );
  }

  const counted = rows.filter((r) => !r.recap.excludeFromAggregates);
  const totalEngagements = counted.reduce(
    (s, r) => s + (r.recap.totalEngagements ?? 0),
    0,
  );
  const totalSold = counted.reduce(
    (s, r) => s + (r.recap.productsSold ?? 0),
    0,
  );
  const conversion = sumConversionBases(
    counted.map(({ recap }) => ({
      requestType: null,
      recapType: recap.recapType,
      engagements: recap.totalEngagements,
      consumersSampled: recap.consumersSampled,
      productsSold: recap.productsSold,
      isDryDemo: recap.isDryDemo,
      peopleEngaged: recap.peopleEngaged,
    })),
  );
  const convBase = conversion.engagements;
  const convSold = conversion.sold;
  const fmt = (d: string | null) => {
    if (!d) return "";
    const parsed = parseCalendarDate(d);
    if (!parsed) return d;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="spark-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            FIELD REPORTS · {rows.length}
          </p>
          <h2
            className="text-lg font-semibold mt-1"
            style={{ color: "var(--spark-text)" }}
          >
            {`${rows.length} recap${rows.length === 1 ? "" : "s"} submitted`}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <p
              className="tab-num font-bold text-base"
              style={{ color: "var(--spark-lime)" }}
            >
              {totalEngagements.toLocaleString()}
            </p>
            <p className="label-mini">CONSUMERS</p>
          </div>
          <div>
            <p className="tab-num font-bold text-base">
              {totalSold.toLocaleString()}
            </p>
            <p className="label-mini">SOLD</p>
          </div>
          <div>
            <p
              className="tab-num font-bold text-base"
              style={{ color: "var(--spark-lime)" }}
            >
              {convBase > 0
                ? `${Math.round((convSold / convBase) * 100)}%`
                : "—"}
            </p>
            <p className="label-mini">CONV</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(({ recap, eventName, eventDate }) => {
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
                  {recap.approved ? "APPROVED" : "DRAFT"}
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
                  title={cleanVenueTitle(recap.name) || eventName || "Recap"}
                >
                  {cleanVenueTitle(recap.name) || eventName || "Recap"}
                </p>
                <p
                  className="mono text-[10px] uppercase mt-1 truncate"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  {baName ? `BY ${baName} · ` : ""}
                  {fmt(eventDate)}
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

      {awaiting.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-4 pt-3" style={{ borderTop: "1px solid var(--spark-border)" }}>
          <span
            className="mono text-[10px]"
            style={{ letterSpacing: "0.14em", color: "var(--spark-orange)" }}
          >
            AWAITING RECAP · {awaiting.length}
          </span>
          {awaiting.map((ev) => (
            <Link
              key={ev.uuid}
              to={`/event/view/${ev.uuid}`}
              state={{ from: `/request/view/${request.uuid}` }}
              className="text-xs"
              style={{ color: "var(--spark-text-secondary)", textDecoration: "none" }}
            >
              {ev.name}
              {ev.date ? ` (${fmt(ev.date)})` : ""} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SparkRequestView() {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();
  const from =
    (location.state as { from?: string })?.from ?? "/requests/list";
  if (!uuid) {
    return (
      <Layout>
        <div
          className="spark-card p-10 text-center max-w-3xl"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Request not found.
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-3xl"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading request…
          </div>
        }
      >
        <Inner uuid={uuid} from={from} />
      </Suspense>
    </Layout>
  );
}
