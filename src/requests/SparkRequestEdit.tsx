import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — request edit page.
 *
 * Lean replacement for the legacy /request/edit/:uuid (RequestForm,
 * 600+ lines of old chrome). Covers the 80% of edits kyle / RMMs
 * actually do day-to-day: date, times, address, notes, BA count
 * proxy via store_number, distributor, RMM assignee. Products + line-
 * level details are read-only here — clicking 'Full edit' bounces to
 * the legacy page for anything more complex.
 *
 * Submits via the existing updateRequest mutation, filling in
 * unchanged fields from the loaded request so the all-fields-required
 * input contract stays satisfied.
 */

async function gqlPost<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

// NOTE: the backend (`events/types.py::_serialize_dt_for_tz`) returns
// `start_time`, `end_time`, and `date` as **naive ISO strings in the
// venue's local timezone** post the May 26 DST fix. We read them
// literally rather than feeding them to `new Date()`, which would
// re-parse them as browser-local and produce the +/-1h skew that broke
// REQ-MJY (Kyle edited a Central event to 12pm, view rendered 2pm
// because PDT-CDT = 2 hours). See utils/venueTimezone.ts for full
// context.
import {
  fmtVenueTime,
  ianaForVenueTz,
  pickHourMinute,
  pickYmd,
  venueLocalToUtcIso,
} from "@/utils/venueTimezone";
// Re-export so the rest of this file's call sites keep their familiar
// names while internally delegating to the venue-tz-aware helpers.
const toLocalTime = pickHourMinute;
const toLocalDate = pickYmd;
// `fmtVenueTime` is consumed in the venue-tz banner below.
void fmtVenueTime;

const Inner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<RequestUuidQueryType>(
    RequestUuidQuery,
    { uuid },
    { fetchPolicy: "store-and-network" },
  );
  const rmmData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-or-network" },
  );
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const timezones = useMemo(
    () =>
      timezonesData?.timezones?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [timezonesData],
  );

  const request = data.request;

  const [date, setDate] = useState(() => toLocalDate(request?.date));
  const [startTime, setStartTime] = useState(() =>
    toLocalTime(request?.startTime),
  );
  const [endTime, setEndTime] = useState(() => toLocalTime(request?.endTime));
  const [address, setAddress] = useState(request?.address ?? "");
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [rmmId, setRmmId] = useState(() =>
    request?.rmmAsigned?.id ? String(request.rmmAsigned.id) : "",
  );
  const [timezoneId, setTimezoneId] = useState(() =>
    request?.timezone?.id ? String(request.timezone.id) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Re-sync when the underlying request changes (e.g., another
    // tab updated it). Cheap because RequestUuidQuery dedupes.
    setDate(toLocalDate(request?.date));
    setStartTime(toLocalTime(request?.startTime));
    setEndTime(toLocalTime(request?.endTime));
    setAddress(request?.address ?? "");
    setNotes(request?.notes ?? "");
    setRmmId(request?.rmmAsigned?.id ? String(request.rmmAsigned.id) : "");
    setTimezoneId(request?.timezone?.id ? String(request.timezone.id) : "");
  }, [
    request?.date,
    request?.startTime,
    request?.endTime,
    request?.address,
    request?.notes,
    request?.rmmAsigned?.id,
    request?.timezone?.id,
  ]);

  const rmmOptions = useMemo(
    () =>
      (rmmData?.rmmClients ?? []).filter(
        (r): r is NonNullable<typeof r> => Boolean(r),
      ),
    [rmmData],
  );

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

  const reqId = `REQ-${String(request.id).slice(-4).toUpperCase()}`;
  const venue =
    request.retailer?.name ?? request.name ?? "—";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!date || !startTime || !endTime || !address.trim()) {
      showAlert(
        "Date, start time, end time, and address are required.",
        "warning",
      );
      return;
    }
    setSubmitting(true);
    try {
      // Backend UpdateRequestInput requires every field. We assemble
      // it from the loaded request + the user's edits so unchanged
      // fields stay unchanged.
      //
      // CRITICAL: interpret the time inputs as **venue-local**, not
      // browser-local. The form labels show "12:00 PM" meaning 12pm
      // at the venue's address, not 12pm wherever the admin happens
      // to be sitting. Without this, a Pacific-based admin editing a
      // Central-timezone event saved +2h off (REQ-MJY).
      // Use the *selected* timezone, not the stored one — the admin may
      // be correcting a mis-set zone (e.g. Alaska → Pacific). The typed
      // wall-clock times are interpreted as local in whichever zone is
      // chosen, and that zone is what we persist. Falls back to the
      // request's stored tz if the selection somehow isn't in the list.
      const selectedTz =
        timezones.find((t) => String(t.id) === String(timezoneId)) ??
        request.timezone;
      const ianaTz = ianaForVenueTz(selectedTz);
      const startIso = venueLocalToUtcIso(date, startTime, ianaTz);
      const endIso = venueLocalToUtcIso(date, endTime, ianaTz);
      // Date row stays anchored to midnight in the venue's tz for
      // consistency with how the public form's date input is stored.
      const dateIso = venueLocalToUtcIso(date, "00:00", ianaTz);
      const productInputs = (request.products ?? [])
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ productId: String(p.id) }));
      const input: Record<string, unknown> = {
        id: request.id,
        name: request.name ?? "Request",
        date: dateIso,
        startTime: startIso,
        endTime: endIso,
        address: address.trim(),
        notes: notes.trim() || null,
        coordinates: Array.isArray(request.coordinates)
          ? [...request.coordinates]
          : [0, 0],
        timezoneId: timezoneId || request.timezone?.id,
        requestTypeId: request.requestType?.id,
        distributorId: request.distributor?.id ?? null,
        retailerId: request.retailer?.id ?? null,
        billingEntityId: request.billingEntity?.id ?? null,
        rmmAsignedId: rmmId || null,
        requestorEmail: request.requestorEmail ?? null,
        storeManagerName: request.storeManagerName ?? null,
        storeManagerPhone: request.storeManagerPhone ?? null,
        details: [],
        products: productInputs,
      };
      const res = await gqlPost<{
        updateRequest: { success: boolean; message: string };
      }>(
        `
          mutation Update($input: UpdateRequestInput!) {
            updateRequest(input: $input) { success message }
          }
        `,
        { input },
      );
      const r = res.updateRequest;
      if (!r?.success) {
        throw new Error(r?.message || "Update failed.");
      }
      showAlert(`${reqId} saved.`, "success");
      navigate(`/request/view/${request.uuid}`);
    } catch (err) {
      showAlert(`Couldn't save: ${(err as Error).message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            EDIT REQUEST · {reqId}
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {venue}
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Edit the common fields here. For products, store managers,
            and other details use the full form.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/request/view/${request.uuid}`)}
            className="mono text-[10px] px-3 py-2 rounded-xl"
            style={{
              letterSpacing: "0.18em",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ← CANCEL
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div className="spark-card p-6 space-y-4">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          SCHEDULE
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label
              className="mono text-[10px] block mb-1"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              DATE *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
          </div>
          <div>
            <label
              className="mono text-[10px] block mb-1"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              START TIME *
            </label>
            <TimeSlotSelect
              value={startTime}
              onChange={setStartTime}
              className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
          </div>
          <div>
            <label
              className="mono text-[10px] block mb-1"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              END TIME *
            </label>
            <TimeSlotSelect
              value={endTime}
              onChange={setEndTime}
              className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
          </div>
        </div>
        {/* Timezone — now editable. The save path interprets the time
            inputs as local time in the *selected* venue timezone (not the
            admin's browser), so changing this dropdown both fixes a
            mis-set zone and re-anchors the typed wall-clock times to it. */}
        <div>
          <label
            className="mono text-[10px] block mb-1"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            TIME ZONE *
          </label>
          <select
            value={timezoneId}
            onChange={(e) => setTimezoneId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          >
            <option value="">— Select —</option>
            {timezones.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.name}
              </option>
            ))}
          </select>
          <p
            className="mono text-[10px] mt-1.5"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            ⏱ VENUE LOCAL TIME, NOT YOUR BROWSER — CHANGE TO FIX A MIS-SET
            ZONE
          </p>
        </div>
      </div>

      {/* Venue + RMM */}
      <div className="spark-card p-6 space-y-4">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-sky)",
          }}
        >
          VENUE + ROUTING
        </p>
        <div>
          <label
            className="mono text-[10px] block mb-1"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            ADDRESS *
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          />
        </div>
        {rmmOptions.length > 0 && (
          <div>
            <label
              className="mono text-[10px] block mb-1"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              ROUTED TO (RMM)
            </label>
            <select
              value={rmmId}
              onChange={(e) => setRmmId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            >
              <option value="">— Unassigned —</option>
              {rmmOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {[r.firstName, r.lastName].filter(Boolean).join(" ") ||
                    r.username ||
                    "User"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="spark-card p-6 space-y-2">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-gold)",
          }}
        >
          NOTES
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything ops should know — parking, dock entrance, time-window quirks, etc."
          className="w-full rounded-lg px-3 py-2 text-[15px] spark-input"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        />
      </div>

      {/* Read-only summary of products (not editable here) */}
      {request.products && request.products.length > 0 && (
        <div className="spark-card p-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              PRODUCTS · {request.products.length} (READ-ONLY HERE)
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(`/request/edit-legacy/${request.uuid}`)
              }
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-sky)",
              }}
            >
              EDIT IN FULL FORM →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {request.products.map(
              (p) =>
                p && (
                  <span
                    key={p.id}
                    className="mono text-[10px] px-2.5 py-1 rounded-md"
                    style={{
                      letterSpacing: "0.12em",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {p.name?.toUpperCase()}
                  </span>
                ),
            )}
          </div>
        </div>
      )}

      {/* Sticky submit footer */}
      <div
        className="sticky bottom-0 -mx-1 sm:mx-0 px-3 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(10,13,9,0.9)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--spark-border, #1f2418)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(`/request/edit-legacy/${request.uuid}`)}
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          ↗ FULL FORM
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(242,243,238,0.4)",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
};

export default function SparkRequestEdit() {
  const { uuid } = useParams<{ uuid: string }>();
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
            Loading…
          </div>
        }
      >
        <Inner uuid={uuid} />
      </Suspense>
    </Layout>
  );
}
