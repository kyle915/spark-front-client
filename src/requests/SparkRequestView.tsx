import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useLocation, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LocationMap from "@shared/LocationMap";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";

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

const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-orange",
  queue: "chip chip-gold",
  approved: "chip chip-purple",
  scheduled: "chip chip-sky",
  done: "chip chip-lime",
  declined: "chip chip-muted",
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

  const canDecide = !role.isClient && slug === "pending";

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
        {canDecide && (
          <>
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
          </>
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
      </div>

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
          <Field label="ADDRESS">{request.address || "—"}</Field>
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
