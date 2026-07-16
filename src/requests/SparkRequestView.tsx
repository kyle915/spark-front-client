import { Fragment, Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useLocation, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LocationMap from "@shared/LocationMap";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";
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
import { pickHeroImage } from "@/utils/recapFileUrl";

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
  baName: string | null;
  hero: string | null;
  fileCount: number;
};

type RequestEvent = NonNullable<
  NonNullable<RequestUuidQueryType["response"]["request"]>["events"]
>[number];
type LegacyRecap = NonNullable<NonNullable<RequestEvent>["recaps"]>[number];
type CustomRecap = NonNullable<
  NonNullable<RequestEvent>["customRecaps"]
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
      📊 Sheet ↗
    </a>
  );
};

const NotesLoader: React.FC<{
  requestUuid: string;
  requestLabel: string;
}> = ({ requestUuid, requestLabel }) => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters: tenantId ? { tenantId } : null, first: 500 },
    { fetchPolicy: "store-or-network" },
  );
  // Build mention roster from real admin users so @-handles resolve
  // to actual emails for the notifyNoteMention fanout.
  const mentionables: Mentionable[] = useMemo(() => {
    const rows = (data?.users?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
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
      .filter((m) => m.email);
  }, [data]);
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
 *
 * Inline approve/decline appears only when the request is pending
 * and the viewer is an admin — saves the trip back to /approvals
 * just to click yes/no.
 */

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

// NOTE: backend returns naive ISO strings in the venue's local timezone
// (see events/types.py::_serialize_dt_for_tz). We render literally so
// what the form saved is what the view shows, regardless of which tz
// the admin's browser is in. Going through `new Date()` re-parses as
// browser-local and was the source of the +/-1h skew on REQ-MJY (12pm
// Central edit rendered as 2pm because PDT-CDT = +2h).
const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "";
  const m = raw.match(/T(\d{2}):(\d{2})/);
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
};

// Friendly labels for the two-value schedulingStatus metadata field.
const SCHEDULING_LABEL: Record<string, string> = {
  already_scheduled: "Already scheduled with the account",
  needs_scheduling: "Needs scheduling by Ignite",
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
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </p>
    <div
      className="text-sm"
      style={{ color: "rgba(255,255,255,0.85)" }}
    >
      {children}
    </div>
  </div>
);

const Inner: React.FC<{ uuid: string; from: string }> = ({ uuid, from }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const role = useSparkRole();
  const data = useLazyLoadQuery<RequestUuidQueryType>(
    RequestUuidQuery,
    { uuid },
    { fetchPolicy: "store-and-network" },
  );
  const request = data.request as Request | null;

  const [busy, setBusy] = useState(false);
  const [decliningOpen, setDecliningOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Pick the relay id of the first event on this request to use as the
  // invite target. Admins can only invite when there's a real event
  // row to invite TO — pending requests with no event yet don't show
  // the button.
  // Pick the first usable event on the request — its id, date, and
  // address all flow into InviteBAModal so the modal can rank BAs by
  // locality and flag "already on another shift that day" conflicts.
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
        style={{ color: "rgba(255,255,255,0.55)" }}
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
    request.retailer?.name ?? request.retailerName ?? request.name ?? "—";
  const market = (() => {
    const city = request.retailer?.location?.name ?? "";
    const state = request.retailer?.location?.state?.code ?? "";
    return [city, state].filter(Boolean).join(", ") || "—";
  })();
  // The fullest address we can show. New requests store a complete
  // Google-formatted address (street, city, state, ZIP) in `address` — shown
  // verbatim. For older/partial ones (a bare street like REQ-925), append
  // city/state/ZIP from the linked retailer location when we have it.
  const fullAddress = (() => {
    const street = (request.address ?? "").trim();
    if (street && /\b\d{5}\b/.test(street)) return street;
    const city = request.retailer?.location?.name ?? "";
    const st = request.retailer?.location?.state?.code ?? "";
    const zip = request.retailer?.location?.zip ?? "";
    const region = [st, zip].filter(Boolean).join(" ");
    const tail = [city, region].filter(
      (p) => p && !street.toLowerCase().includes(p.toLowerCase()),
    );
    return [street, ...tail].filter(Boolean).join(", ") || "—";
  })();
  const requestorName = [
    request.createdBy?.firstName,
    request.createdBy?.lastName,
  ]
    .filter(Boolean)
    .join(" ") || request.requestorEmail || "—";
  const approverName = [
    request.approvedBy?.firstName,
    request.approvedBy?.lastName,
  ]
    .filter(Boolean)
    .join(" ") || "—";

  // Approve is available to clients too — the backend `approveRequest`
  // enforces tenant membership + blocks BAs (exactly like the emailed
  // approval link), so it's safe to expose. Decline stays admin-only: it
  // sends a decline-reason email to the requestor (an RMM/ops action).
  const canApprove = slug === "pending";
  const canDecline = !role.isClient && slug === "pending";

  const confirmApprove = async () => {
    setBusy(true);
    try {
      const result = await callApprovalMutation("approveRequest", {
        input: { id: request.id },
      });
      if (!result.success) throw new Error(result.message || "Approve failed.");
      showAlert(`Approved ${reqId} — event queued for staffing.`, "success");
      setApproveOpen(false);
      // Re-fetch so the status chip + approved-by show fresh.
      window.location.reload();
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
      window.location.reload();
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
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {reqId}
            </span>
            <span className={chipClass}>
              {(request.status?.name ?? slug).toUpperCase()}
            </span>
            {request.requestType?.name && (
              <span className="chip chip-muted">
                {request.requestType.name.toUpperCase()}
              </span>
            )}
          </div>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {venue}
          </h1>
          <p
            className="mt-1"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {market} · {fmtDate(request.date)}
            {request.startTime && request.endTime
              ? ` · ${fmtTime(request.startTime)} – ${fmtTime(request.endTime)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LinkedSheetChipForView />
          <button
            onClick={() => navigate(from)}
            className="mono text-[10px] px-3 py-2 rounded-xl"
            style={{
              letterSpacing: "0.18em",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ← BACK
          </button>
        </div>
      </div>

      {/* Decline reason banner */}
      {slug === "declined" && request.declineReason && (
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
            DECLINE REASON
          </p>
          <p
            className="text-sm italic"
            style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}
          >
            "{request.declineReason}"
          </p>
          <p
            className="mono text-[10px] mt-2"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            — {approverName}
          </p>
        </div>
      )}

      {/* Quick actions row. Approve/Decline only when pending +
          viewer is admin. Duplicate is always available because that's
          the common pattern: "schedule another visit at the same
          venue". Edit always available too (legacy edit form). */}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            onClick={() => setApproveOpen(true)}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
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
            // Build the prefill query for the create form. We pass
            // relay IDs as-is since the form's <select> values
            // compare against the same relay IDs from the catalog.
            // Date is intentionally omitted — duplicating to a new
            // date is the whole point.
            const params = new URLSearchParams();
            if (venue) params.set("venue", venue);
            if (request.address) params.set("address", request.address);
            if (request.startTime) {
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
            if (request.endTime) {
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
            if (request.requestType?.id)
              params.set("requestTypeId", String(request.requestType.id));
            if (request.timezone?.id)
              params.set("timezoneId", String(request.timezone.id));
            if (request.distributor?.id)
              params.set("distributorId", String(request.distributor.id));
            if (request.schedulingStatus)
              params.set("schedulingStatus", request.schedulingStatus);
            if (request.notes) params.set("notes", request.notes);
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
          📊 Report
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
          🖨 Print brief
        </button>
        {role.isAdmin && eventForInvite && (
          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 16px rgba(197,245,70,0.35)",
            }}
            title="Invite a brand ambassador to this shift — they'll get a push on their phone"
          >
            ✦ Invite BA
          </button>
        )}
      </div>

      {inviteOpen && eventForInvite && (
        <InviteBAModal
          eventId={eventForInvite}
          eventDate={eventForInviteDate}
          eventAddress={eventForInviteAddress}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {/* Details grid */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          ACTIVATION DETAILS
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="VENUE">{venue}</Field>
          <Field label="MARKET">{market}</Field>
          <Field label="ADDRESS">{fullAddress}</Field>
          <Field label="REQUEST TYPE">
            {request.requestType?.name ?? "—"}
          </Field>
          <Field label="DATE">{fmtDate(request.date)}</Field>
          <Field label="TIME">
            {request.startTime && request.endTime
              ? `${fmtTime(request.startTime)} – ${fmtTime(request.endTime)}`
              : "—"}
          </Field>
          {request.timezone?.name && (
            <Field label="TIME ZONE">{request.timezone.name}</Field>
          )}
          {request.distributor?.name && (
            <Field label="DISTRIBUTOR">{request.distributor.name}</Field>
          )}
          {request.schedulingStatus && (
            <Field label="SCHEDULING">
              {SCHEDULING_LABEL[request.schedulingStatus] ??
                request.schedulingStatus}
            </Field>
          )}
        </div>
      </div>

      {/* Venue map — only when coordinates are on the request. Many
          legacy rows are missing them, so we degrade silently rather
          than render an empty/grey map. */}
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

      {/* Contacts */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-sky)",
          }}
        >
          CONTACTS
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="REQUESTOR">
            {requestorName}
            {request.requestorEmail && (
              <div
                className="mono text-[11px] mt-0.5"
                style={{
                  letterSpacing: "0.04em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {request.requestorEmail}
              </div>
            )}
          </Field>
          {request.storeManagerName && (
            <Field label="STORE MANAGER">
              {request.storeManagerName}
              {request.storeManagerPhone && (
                <div
                  className="mono text-[11px] mt-0.5"
                  style={{
                    letterSpacing: "0.04em",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {request.storeManagerPhone}
                </div>
              )}
            </Field>
          )}
          {request.retailer?.storeContact && (
            <Field label="STORE CONTACT">
              {request.retailer.storeContact}
            </Field>
          )}
          {request.rmmAsigned && (
            <Field label="ROUTED TO">
              {[
                request.rmmAsigned.firstName,
                request.rmmAsigned.lastName,
              ]
                .filter(Boolean)
                .join(" ") || "—"}
            </Field>
          )}
        </div>
      </div>

      {/* Notes */}
      {request.notes && (
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
            style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}
          >
            {request.notes}
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
                  background: "rgba(255,255,255,0.025)",
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
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.4)",
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
                        color: "rgba(255,255,255,0.4)",
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

      {/* Internal notes + @-mention. Same panel as Master Tracker
          expanded rows — shares the localStorage bucket, so notes
          added here show up there and vice versa. */}
      <Suspense
        fallback={
          <div
            className="spark-card p-5 text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
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

      {/* Smart staffing + Roster — per event, admin-only. The
          Smart-staffing panel sits directly above each event's roster:
          fill status + a server-ranked BA shortlist with a bulk
          "Invite selected" action. The roster below shows who's
          already invited / accepted. BAs don't need to see either, so
          both are gated behind the admin role. */}
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

      {/* Field reports — every recap submitted against the events
          on this request. Surfaces the photos + headline metrics so
          you don't have to bounce to /recaps to see what happened. */}
      <FieldReportsPanel request={request} />

      {/* Shift Replay — one panel per event with a GPS trail. Renders
          nothing for events without any pings, so unmonitored shifts
          don't pollute the page. */}
      {(request.events ?? [])
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((ev) => (
          <div key={String(ev.uuid)} className="space-y-4">
            <ShiftReplayPanel eventUuid={String(ev.uuid)} />
            <EventAttendanceTable eventUuid={String(ev.uuid)} />
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
                color: "rgba(255,255,255,0.45)",
              }}
            >
              CREATED
            </p>
            <p style={{ color: "rgba(255,255,255,0.75)" }}>
              {fmtDate(request.createdAt)} by {requestorName}
            </p>
          </div>
          {slug === "approved" && (
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
              <p style={{ color: "rgba(255,255,255,0.75)" }}>
                {fmtDate(request.updatedAt)} by {approverName}
              </p>
            </div>
          )}
          {slug === "declined" && (
            <div>
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-orange)",
                }}
              >
                DECLINED
              </p>
              <p style={{ color: "rgba(255,255,255,0.75)" }}>
                {fmtDate(request.updatedAt)} by {approverName}
              </p>
            </div>
          )}
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              LAST UPDATED
            </p>
            <p style={{ color: "rgba(255,255,255,0.75)" }}>
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
            background: "rgba(10,11,13,0.7)",
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
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              <strong>{venue}</strong> · {market} · {fmtDate(request.date)}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => !busy && setApproveOpen(false)}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
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
                  color: "#0a0d09",
                  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
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
            background: "rgba(10,11,13,0.7)",
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
              style={{ color: "rgba(255,255,255,0.7)" }}
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
                    : "rgba(255,255,255,0.45)",
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
                  color: "rgba(255,255,255,0.55)",
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
                  color: "#0a0d09",
                  opacity: busy || declineReason.trim().length < 8 ? 0.5 : 1,
                }}
              >
                {busy ? "Sending…" : "Decline + send comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Field Reports — every recap submitted against the events on this
// request. We render one row per recap with a hero image, BA name,
// engagement + sold counts, and a click-through to the recap detail.
// Empty events get a soft "awaiting recap" placeholder so dispatchers
// can see at a glance which shifts haven't reported in yet.
type FieldReportsRequest = NonNullable<
  RequestUuidQueryType["response"]["request"]
>;

const FieldReportsPanel: React.FC<{ request: FieldReportsRequest }> = ({
  request,
}) => {
  const navigate = useNavigate();
  const events = (request.events ?? []).filter(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );
  if (events.length === 0) return null;

  // Flatten to a flat list of recap rows so the panel reads like a
  // timeline. Each recap remembers its event so we can show which
  // shift it came from when a request has multiple events.
  //
  // BOTH legacy recaps and custom-template recaps belong here — the
  // Master Tracker counts both toward the "● n RECAP" chip, so the panel
  // must show both or it'll under-count vs the list. The two backend
  // types have different shapes (Recap: recapFiles/productsSold;
  // CustomRecap: heroImageUrl/soldUnits), so we normalize each into one
  // RecapCard model and render a single card grid below.
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
        name: ev.name || "Untitled event",
        date: ev.date ?? null,
      });
      continue;
    }
    for (const r of legacy) {
      rows.push({
        eventName: ev.name ?? null,
        eventDate: ev.date ?? null,
        recap: normalizeLegacyRecap(r),
      });
    }
    for (const r of custom) {
      rows.push({
        eventName: ev.name ?? null,
        eventDate: ev.date ?? null,
        recap: normalizeCustomRecap(r),
      });
    }
  }

  // Headline: total recaps + total engagements aggregated across
  // every event on this request.
  const totalEngagements = rows.reduce(
    (s, r) => s + (r.recap.totalEngagements ?? 0),
    0,
  );
  const totalSold = rows.reduce(
    (s, r) => s + (r.recap.productsSold ?? 0),
    0,
  );
  const fmt = (d: string | null) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="spark-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            FIELD REPORTS
          </p>
          <h2
            className="text-lg font-semibold mt-1"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {rows.length === 0
              ? "No recaps submitted yet"
              : `${rows.length} recap${rows.length === 1 ? "" : "s"} submitted`}
          </h2>
        </div>
        {rows.length > 0 && (
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
                {totalEngagements > 0
                  ? `${Math.round((totalSold / totalEngagements) * 100)}%`
                  : "—"}
              </p>
              <p className="label-mini">CONV</p>
            </div>
          </div>
        )}
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
                    "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
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
                      background: "rgba(197,245,70,0.15)",
                      color: "var(--spark-lime)",
                      border: "1px solid rgba(197,245,70,0.35)",
                    }}
                  >
                    ◉ {fileCount} FILE{fileCount === 1 ? "" : "S"}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p
                  className="font-bold text-sm truncate"
                  title={recap.name ?? eventName ?? "Recap"}
                >
                  {recap.name ?? eventName ?? "Recap"}
                </p>
                <p
                  className="mono text-[10px] uppercase mt-1 truncate"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
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

        {awaiting.map((ev) => (
          <div
            key={ev.uuid}
            className="spark-card overflow-hidden"
            style={{
              borderStyle: "dashed",
              opacity: 0.7,
            }}
          >
            <div
              className="h-32 relative overflow-hidden grid place-items-center"
              style={{
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div className="text-center">
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  AWAITING RECAP
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {ev.name}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p
                className="mono text-[10px] uppercase truncate"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {fmt(ev.date)}
              </p>
            </div>
          </div>
        ))}
      </div>
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
          style={{ color: "rgba(255,255,255,0.55)" }}
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
            style={{ color: "rgba(255,255,255,0.55)" }}
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
