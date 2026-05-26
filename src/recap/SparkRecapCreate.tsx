import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { CreateRecapMutation } from "@/api/mutations/CreateRecapMutation";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { CreateRecapMutation as CreateRecapMutationType } from "@/api/mutations/__generated__/CreateRecapMutation.graphql";
import RecapUploader from "./RecapUploader";
import { useAlertStore } from "@/store/alertStore";
import { useSparkRole } from "@/hooks/useSparkRole";

/**
 * Spark v2 — manual recap submission flow.
 *
 *  - BA-driven path: the assigned ambassador picks the shift on the BA
 *    portal / mobile app and lands here pre-scoped to that event. The
 *    `ambassador_id` is set from the current user on the backend.
 *  - Admin-driven path: any admin can land at /recap/create unscoped,
 *    pick the event manually, optionally override the ambassador (so
 *    they can fill in for a BA who can't), and submit.
 *
 *  Both share the same form. We capture all of: numbers grid, consumer
 *  voice (quotes / feedback / demographics / positive stories / reasons
 *  to decline), account feedback, and direct file uploads. Files upload
 *  to GCS first (via signed-URL); the resulting blob paths are passed
 *  into the createRecap mutation `files[]`.
 */
export default function SparkRecapCreate() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const { isAdmin } = useSparkRole();
  const [params] = useSearchParams();
  const presetEventUuid = params.get("event");

  const [eventQ, setEventQ] = useState("");
  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { first: 30, q: eventQ || null, filters: null },
    { fetchPolicy: "store-or-network" },
  );
  const events = useMemo(
    () =>
      (eventsData.events?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => !!n),
    [eventsData],
  );

  // Auto-select if the URL gave us an event uuid
  const initialEvent = presetEventUuid
    ? events.find((e) => e.uuid === presetEventUuid) ?? null
    : null;
  const [selectedEvent, setSelectedEvent] = useState<typeof events[number] | null>(initialEvent);

  // Numbers
  const [totalConsumer, setTotalConsumer] = useState("");
  const [firstTime, setFirstTime] = useState("");
  const [brandAware, setBrandAware] = useState("");
  const [willing, setWilling] = useState("");
  const [notWilling, setNotWilling] = useState("");
  const [productsSold, setProductsSold] = useState("");
  const [totalCansSold, setTotalCansSold] = useState("");
  const [totalPacksSold, setTotalPacksSold] = useState("");
  // Tracks whether productsSold was set by the auto-calc (Cans + Packs)
  // or typed manually. We only auto-write when the user hasn't touched
  // it themselves — once they edit Products Sold by hand we stop
  // clobbering their value.
  const [productsSoldManual, setProductsSoldManual] = useState(false);
  const [accountSpend, setAccountSpend] = useState("");
  const [trafficDescription, setTrafficDescription] = useState("");
  const [competitivePresence, setCompetitivePresence] = useState("");

  // Consumer voice
  const [quotes, setQuotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [demographics, setDemographics] = useState("");
  const [positiveStories, setPositiveStories] = useState("");
  const [reasonsToDecline, setReasonsToDecline] = useState("");

  // Account feedback
  const [doDifferently, setDoDifferently] = useState("");
  const [accountNotes, setAccountNotes] = useState("");
  const [corpoCardUsed, setCorpoCardUsed] = useState(false);

  // Files
  const [photoBlobs, setPhotoBlobs] = useState<string[]>([]);
  const [receiptBlobs, setReceiptBlobs] = useState<string[]>([]);

  // Admin-only ambassador override (uuid). BA flow leaves blank → backend
  // pulls ambassador from auth.user.
  const [ambassadorOverride, setAmbassadorOverride] = useState("");
  const [fillingForOther, setFillingForOther] = useState(false);

  const [commit, inFlight] = useMutation<CreateRecapMutationType>(CreateRecapMutation);

  const num = (s: string): number | null => {
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) {
      showAlert("Pick the event this recap is for.", "warning");
      return;
    }
    const files = [
      ...photoBlobs.map((blob) => ({ file: blob, fileTypeId: "1", fileRecapCategoryId: "1" })),
      ...receiptBlobs.map((blob) => ({ file: blob, fileTypeId: "1", fileRecapCategoryId: "2" })),
    ];
    commit({
      variables: {
        input: {
          eventId: selectedEvent.id,
          name: `${selectedEvent.request?.retailer?.name ?? selectedEvent.name} recap`,
          ambassadorId: isAdmin && fillingForOther ? ambassadorOverride || null : null,
          fillingForAmbassador: isAdmin && fillingForOther,
          totalCansSold: num(totalCansSold),
          totalPacksSold: num(totalPacksSold),
          productsSold: num(productsSold),
          accountSpendAmount: num(accountSpend),
          trafficDescription: trafficDescription || null,
          competitivePresence: competitivePresence || null,
          consumerEngagements: {
            totalConsumer: num(totalConsumer),
            firstTimeConsumers: num(firstTime),
            brandAwareConsumers: num(brandAware),
            willingToPurchaseConsumers: num(willing),
            notWillingConsumers: num(notWilling),
          },
          consumerFeedback: {
            quotes,
            feedback,
            demographics,
            positiveStories,
            reasonsToDecline,
          },
          accountFeedback: {
            doDifferentlyFeedback: doDifferently,
            feedback: accountNotes,
            wasCorpoCardUsed: corpoCardUsed,
          },
          files,
        },
      },
      onCompleted: (res) => {
        if (res.createRecap?.success && res.createRecap.recap?.uuid) {
          showAlert("Recap submitted.", "success");
          navigate(`/recap/view/${res.createRecap.recap.uuid}`);
        } else {
          showAlert(res.createRecap?.message ?? "Recap submission failed.", "error");
        }
      },
      onError: (err) => showAlert(`Recap failed: ${err.message}`, "error"),
    });
  };

  // For the uploader we need a stub uuid so it can namespace blob paths
  // by event. Once createRecap returns the real recap uuid we re-key
  // file rows server-side via AddRecapFile.
  const stubUuid = selectedEvent?.uuid ?? "new";

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto px-1 sm:px-0 space-y-5">
      <div className="spark-card p-6">
        <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}>
          NEW RECAP
        </p>
        <h1 className="display text-3xl font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
          Tell us how it went.
        </h1>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          {isAdmin
            ? "Filling on behalf of a BA? Toggle that below."
            : "We'll auto-link this recap to your assigned shift."}
        </p>
      </div>

      {/* Event picker */}
      <Card title="EVENT">
        {selectedEvent ? (
          <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}>
            <div>
              <p className="display font-bold text-lg">
                {selectedEvent.request?.retailer?.name ?? selectedEvent.name}
              </p>
              <p className="mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em" }}>
                {selectedEvent.date} · {selectedEvent.address}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedEvent(null)} className="mono text-[10px] px-3 py-1.5 rounded-full" style={{ letterSpacing: "0.18em", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              CHANGE
            </button>
          </div>
        ) : (
          <>
            <input
              value={eventQ}
              onChange={(e) => setEventQ(e.target.value)}
              placeholder="Search events by name, retailer, or address…"
              className={inputCls}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-96 overflow-y-auto">
              {events.map((evt) => (
                <button
                  type="button"
                  key={evt.uuid}
                  onClick={() => setSelectedEvent(evt)}
                  className="text-left rounded-xl p-3"
                  style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}
                >
                  <p className="text-sm font-semibold">{evt.request?.retailer?.name ?? evt.name}</p>
                  <p className="mono text-[10px] mt-1" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}>
                    {evt.date} · {evt.address?.slice(0, 60)}
                  </p>
                </button>
              ))}
              {events.length === 0 && (
                <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>
                  NO MATCHES
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Admin-only filling-for toggle */}
      {isAdmin && (
        <Card title="FILLING FOR A BA?">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fillingForOther} onChange={(e) => setFillingForOther(e.target.checked)} />
            <span className="text-sm">Yes, I'm submitting this on behalf of an ambassador.</span>
          </label>
          {fillingForOther && (
            <input
              value={ambassadorOverride}
              onChange={(e) => setAmbassadorOverride(e.target.value)}
              placeholder="Ambassador uuid (leave blank to leave unassigned)"
              className={inputCls}
            />
          )}
        </Card>
      )}

      {/* Numbers */}
      <Card title="NUMBERS">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Samples / Total Consumer">
            <input value={totalConsumer} onChange={(e) => setTotalConsumer(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="First-Time">
            <input value={firstTime} onChange={(e) => setFirstTime(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Brand-Aware">
            <input value={brandAware} onChange={(e) => setBrandAware(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Willing to Buy">
            <input value={willing} onChange={(e) => setWilling(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Not Willing">
            <input value={notWilling} onChange={(e) => setNotWilling(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Products Sold *">
            <input
              value={productsSold}
              onChange={(e) => {
                // User-typed change — stop auto-populating from
                // Cans + Packs from this point on so we don't clobber
                // their intentional override.
                setProductsSold(e.target.value);
                setProductsSoldManual(true);
              }}
              className={inputCls}
              inputMode="numeric"
              placeholder="0"
              title="Auto-fills from Cans + Packs until you edit it"
            />
          </Field>
          <Field label="Cans Sold">
            <input
              value={totalCansSold}
              onChange={(e) => {
                const next = e.target.value;
                setTotalCansSold(next);
                // Auto-update Products Sold from Cans + Packs unless
                // the user has manually edited Products Sold.
                if (!productsSoldManual) {
                  const cans = Number(next) || 0;
                  const packs = Number(totalPacksSold) || 0;
                  const sum = cans + packs;
                  setProductsSold(sum > 0 ? String(sum) : "");
                }
              }}
              className={inputCls}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Packs Sold">
            <input
              value={totalPacksSold}
              onChange={(e) => {
                const next = e.target.value;
                setTotalPacksSold(next);
                if (!productsSoldManual) {
                  const cans = Number(totalCansSold) || 0;
                  const packs = Number(next) || 0;
                  const sum = cans + packs;
                  setProductsSold(sum > 0 ? String(sum) : "");
                }
              }}
              className={inputCls}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Account Spend ($)">
            <input value={accountSpend} onChange={(e) => setAccountSpend(e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
          </Field>
        </div>
        <p
          className="text-[11px] opacity-60 mt-2"
          style={{ fontFamily: "var(--mono-stack)" }}
        >
          * Products Sold auto-fills from Cans + Packs. Type a value to
          override.
        </p>
        <Field label="Traffic Description">
          <textarea value={trafficDescription} onChange={(e) => setTrafficDescription(e.target.value)} className={inputCls} rows={2} placeholder="Foot traffic, busy hours, slow patches…" />
        </Field>
        <Field label="Competitive Presence">
          <textarea value={competitivePresence} onChange={(e) => setCompetitivePresence(e.target.value)} className={inputCls} rows={2} placeholder="Other brands on display? Demos in the store?" />
        </Field>
      </Card>

      {/* Consumer voice */}
      <Card title="CONSUMER VOICE">
        <Field label="Quotes (direct lines from real consumers)">
          <textarea value={quotes} onChange={(e) => setQuotes(e.target.value)} className={inputCls} rows={3} />
        </Field>
        <Field label="General Feedback">
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputCls} rows={3} />
        </Field>
        <Field label="Demographics">
          <textarea value={demographics} onChange={(e) => setDemographics(e.target.value)} className={inputCls} rows={2} placeholder="Age, gender mix, vibe of the crowd." />
        </Field>
        <Field label="Positive Stories">
          <textarea value={positiveStories} onChange={(e) => setPositiveStories(e.target.value)} className={inputCls} rows={2} />
        </Field>
        <Field label="Reasons to Decline">
          <textarea value={reasonsToDecline} onChange={(e) => setReasonsToDecline(e.target.value)} className={inputCls} rows={2} />
        </Field>
      </Card>

      {/* Account feedback */}
      <Card title="ACCOUNT FEEDBACK">
        <Field label="What would you do differently next time?">
          <textarea value={doDifferently} onChange={(e) => setDoDifferently(e.target.value)} className={inputCls} rows={2} />
        </Field>
        <Field label="Anything else about this account?">
          <textarea value={accountNotes} onChange={(e) => setAccountNotes(e.target.value)} className={inputCls} rows={2} />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={corpoCardUsed} onChange={(e) => setCorpoCardUsed(e.target.checked)} />
          <span className="text-sm">Corporate card was used for this event spend.</span>
        </label>
      </Card>

      {/* Photos + receipts */}
      <Card title="PHOTOS + RECEIPTS">
        <div className="flex flex-wrap gap-3">
          <RecapUploader
            recapUuid={stubUuid}
            category="photo"
            onUploaded={(blob) => setPhotoBlobs((p) => [...p, blob])}
          />
          <RecapUploader
            recapUuid={stubUuid}
            category="receipt"
            onUploaded={(blob) => setReceiptBlobs((p) => [...p, blob])}
          />
        </div>
        <p className="mono text-[10px] mt-3" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
          {photoBlobs.length} PHOTO{photoBlobs.length === 1 ? "" : "S"} · {receiptBlobs.length} RECEIPT{receiptBlobs.length === 1 ? "" : "S"} READY
        </p>
        {(photoBlobs.length > 0 || receiptBlobs.length > 0) && (
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Files upload to GCS as you pick them — they only get attached to the recap when you submit.
          </p>
        )}
      </Card>

      {/* Sticky submit */}
      <div
        className="sticky bottom-0 -mx-1 sm:mx-0 px-3 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(10,13,9,0.9)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--spark-border)",
        }}
      >
        <div className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
          {selectedEvent ? `EVENT · ${(selectedEvent.request?.retailer?.name ?? selectedEvent.name).toUpperCase()}` : "PICK AN EVENT TO SUBMIT"}
        </div>
        <button
          type="submit"
          disabled={inFlight || !selectedEvent}
          className="px-5 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.4)",
            opacity: inFlight || !selectedEvent ? 0.5 : 1,
          }}
        >
          {inFlight ? "Submitting…" : "Submit recap →"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mono text-[10px] block mb-1.5" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
      {label.toUpperCase()}
    </span>
    {children}
  </label>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="spark-card p-6 space-y-3">
    <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}>
      {title}
    </p>
    {children}
  </div>
);
