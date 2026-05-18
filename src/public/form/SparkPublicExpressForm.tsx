import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import SparkFormLayout from "./layout/FormLayout";
import {
  usePublicProducts,
  usePublicProductTypes,
  usePublicRequestTypes,
  usePublicTimeZones,
  usePublicDistributors,
} from "./hooks";
import { useCreateRequest } from "./hooks/useCreateRequest";
import SharedTimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import type { CreateRequestInput } from "./types/CreateRequestByUrl";
import GooglePlacesInput, { matchTimezoneOption } from "@/components/inputs/GooglePlacesInput";

/**
 * Spark v2 — public Express request form.
 *
 * Mobile-first, single-screen mirror of the internal `/requests/create`
 * Express form. Supports product image picker, multi-date bulk submit,
 * BA count selector, and deep-link prefill of venue/address. Auth-gated
 * bits (RMM/internal notes) are stripped — clients submitting via the
 * public link only see what's relevant to them.
 */
export default function SparkPublicExpressForm() {
  const { tenantSlug } = useParams();
  const slug = tenantSlug ?? "";
  const [searchParams] = useSearchParams();
  // Derive a human brand name from the slug. "ighn-liquid-death" →
  // "Liquid Death". Drops the leading "ighn-" agency prefix if present.
  const brandName = useMemo(() => {
    const cleaned = slug.replace(/^ighn-/, "").replace(/-/g, " ").trim();
    if (!cleaned) return "Brand";
    return cleaned
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }, [slug]);

  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string | null>(null);
  const { products, loading: productsLoading, hasMore, loadMore } = usePublicProducts(
    slug,
    selectedProductTypeId,
  );
  const { productTypes } = usePublicProductTypes(slug);
  const { requestTypes } = usePublicRequestTypes(slug);
  const { timeZones } = usePublicTimeZones();
  const { distributors } = usePublicDistributors(slug);
  const { submit, loading: submitting } = useCreateRequest({ slug });

  // Form state
  const [venue, setVenue] = useState(searchParams.get("venue") ?? "");
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  const [date, setDate] = useState("");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("16:00");
  const [timezoneId, setTimezoneId] = useState("");
  const [requestTypeId, setRequestTypeId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [requestorEmail, setRequestorEmail] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [storeManagerName, setStoreManagerName] = useState("");
  const [storeManagerPhone, setStoreManagerPhone] = useState("");
  const [baCount, setBaCount] = useState(1);
  const [distributorQ, setDistributorQ] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [distributorName, setDistributorName] = useState("");
  // Filter the public distributor list by typed query (case-insensitive
  // prefix match). Cap to 8 visible suggestions so the field doesn't
  // dominate the form on a long list.
  const distributorMatches = useMemo(() => {
    const q = distributorQ.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return (distributors ?? [])
      .filter((d): d is NonNullable<typeof d> => !!d?.name)
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [distributorQ, distributors]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Modal-popup payload shown on successful submit (per Kyle's spec,
  // external form only). Surfaces the RMM the request was routed to so
  // the requestor knows who's approving.
  const [confirmation, setConfirmation] = useState<{
    count: number;
    routedTo: string | null;
    requestorName: string;
  } | null>(null);

  const toggleProduct = (id: string) =>
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const allDates = useMemo(
    () => [date, ...extraDates].filter(Boolean),
    [date, extraDates],
  );

  const canSubmit =
    !!venue &&
    !!address &&
    !!date &&
    !!startTime &&
    !!endTime &&
    !!timezoneId &&
    !!requestTypeId &&
    productIds.length > 0 &&
    !!requestorName.trim() &&
    !!requestorEmail.trim() &&
    !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Please fill in all required fields and pick at least one product.");
      return;
    }

    const notesPlus = [
      notes,
      `BA count: ${baCount}`,
      allDates.length > 1
        ? `Bulk submission — ${allDates.length} visits at this venue.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    let successes = 0;
    let lastRouted: string | null = null;
    const failures: string[] = [];

    for (const d of allDates) {
      // Backend Request.date, start_time, and end_time are ALL
      // DateTimeFields on the Django model — they each need to be ISO
      // strings, not bare YYYY-MM-DD or HH:MM. Combine date + time on
      // every field before posting so Django's validator accepts.
      const isoFor = (hhmm: string) =>
        `${d}T${(hhmm || "12:00").padEnd(5, "0")}:00`;
      const input: CreateRequestInput = {
        name: venue,
        date: isoFor(startTime),
        startTime: isoFor(startTime),
        endTime: isoFor(endTime),
        address,
        coordinates: [0, 0],
        requestorEmail,
        clientName: requestorName || requestorEmail,
        clientEmail: requestorEmail,
        distributorId: distributorId || null,
        distributorName: distributorName,
        distributorEmail: "",
        retailerName: venue,
        retailerAddress: address,
        retailerStoreContact: storeContact,
        storeManagerName,
        storeManagerPhone,
        requestTypeId,
        timezoneId,
        products: productIds.map((productId) => ({ productId })),
        details: [{ isTableNeeded: false, tableSize: null }],
        notes: notesPlus,
      };
      try {
        const result = await submit(input);
        successes += 1;
        // Grab the RMM the *first* successful submission was routed
        // to. With bulk dates the routing is identical for every row
        // since it's keyed on tenant + product, so one is enough.
        if (!lastRouted && result?.rmmAsigned) {
          const first = (result.rmmAsigned.firstName || "").trim();
          const last = (result.rmmAsigned.lastName || "").trim();
          lastRouted =
            [first, last].filter(Boolean).join(" ") ||
            result.rmmAsigned.email ||
            null;
        }
      } catch (err) {
        failures.push(`${d}: ${(err as Error).message}`);
      }
    }

    if (failures.length === 0) {
      setConfirmation({
        count: successes,
        routedTo: lastRouted,
        requestorName: requestorName || requestorEmail.split("@")[0],
      });
      setVenue("");
      setAddress("");
      setDate("");
      setExtraDates([]);
      setProductIds([]);
      setNotes("");
    } else {
      setError(
        `Submitted ${successes} of ${allDates.length}. Failed: ${failures.join("; ")}`,
      );
    }
  };

  return (
    <SparkFormLayout slug={slug}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl mx-auto px-1 sm:px-0 space-y-3"
      >
        {/* Header */}
        <div className="py-2">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.22em",
              color: "var(--spark-lime, #c5f546)",
            }}
          >
            REQUEST A DEMO
          </p>
          <h1
            className="display text-2xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {brandName} BA Request Form
          </h1>
          <p
            className="text-[13px] mt-2 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Tell us where you'd like a sample team. Submissions are routed to
            the applicable {brandName} RMM for approval.
          </p>
        </div>

        {/* Venue + Address */}
        <Card title="VENUE">
          <Field label="Account / Venue Name *">
            <GooglePlacesInput
              value={venue}
              onChange={setVenue}
              bias="establishment"
              onResolved={(p) => {
                // Set the venue to the canonical retailer name (no
                // location suffix) so metrics aggregate by chain.
                // The full address goes into the Address field.
                setVenue(p.retailerName || p.placeName || "");
                if (!address) setAddress(p.formattedAddress);
                if (p.timezoneId) {
                  const match = matchTimezoneOption(p.timezoneId, timeZones);
                  if (match) setTimezoneId(String(match.id));
                }
              }}
              placeholder="e.g., Whole Foods - Brentwood"
              className={inputCls}
            />
          </Field>
          <Field label="Full Address *">
            <GooglePlacesInput
              value={address}
              onChange={setAddress}
              onResolved={(p) => {
                setAddress(p.formattedAddress);
                if (p.timezoneId) {
                  const match = matchTimezoneOption(p.timezoneId, timeZones);
                  if (match) setTimezoneId(String(match.id));
                }
              }}
              placeholder="Start typing — Google suggestions appear"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Store Contact (optional)">
              <input value={storeContact} onChange={(e) => setStoreContact(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Store Manager (optional)">
              <input value={storeManagerName} onChange={(e) => setStoreManagerName(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Store Manager Phone (optional)">
            <input value={storeManagerPhone} onChange={(e) => setStoreManagerPhone(e.target.value)} className={inputCls} />
          </Field>
        </Card>

        {/* Dates */}
        <Card title="DATES & TIMES">
          <Field label="Primary Date *">
            {/* Quick-pick chips for common BA scheduling windows.
                Saves clicks on mobile vs. spinning the calendar wheel.
                Selected chip glows lime. */}
            <div className="flex flex-wrap gap-2 mb-2">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const fmt = (d: Date) =>
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const addDays = (n: number) => {
                  const d = new Date(today);
                  d.setDate(d.getDate() + n);
                  return d;
                };
                const nextDow = (target: number) => {
                  // 0 = Sun ... 6 = Sat. Picks the *next* one, not today.
                  const d = new Date(today);
                  const diff = (target - d.getDay() + 7) % 7 || 7;
                  d.setDate(d.getDate() + diff);
                  return d;
                };
                const fmtChip = (d: Date) =>
                  d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                const presets = [
                  { label: "TODAY", d: today },
                  { label: "TOMORROW", d: addDays(1) },
                  { label: `FRI · ${fmtChip(nextDow(5))}`, d: nextDow(5) },
                  { label: `SAT · ${fmtChip(nextDow(6))}`, d: nextDow(6) },
                  { label: `+7D · ${fmtChip(addDays(7))}`, d: addDays(7) },
                ];
                return presets.map((p) => {
                  const iso = fmt(p.d);
                  const selected = date === iso;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDate(iso)}
                      className="mono text-[10px] px-2.5 py-1.5 rounded-lg transition"
                      style={{
                        letterSpacing: "0.14em",
                        background: selected
                          ? "var(--spark-lime, #c5f546)"
                          : "rgba(255,255,255,0.04)",
                        color: selected ? "#0a0d09" : "rgba(255,255,255,0.7)",
                        border: selected
                          ? "1px solid var(--spark-lime, #c5f546)"
                          : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                });
              })()}
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          {extraDates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                value={d}
                onChange={(e) => {
                  const next = [...extraDates];
                  next[i] = e.target.value;
                  setExtraDates(next);
                }}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setExtraDates(extraDates.filter((_, j) => j !== i))}
                className="px-3 rounded-xl text-sm"
                style={{ background: "rgba(239,90,42,0.15)", color: "var(--spark-orange, #ef5a2a)", border: "1px solid rgba(239,90,42,0.4)" }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExtraDates([...extraDates, ""])}
            className="mono text-[11px] px-3 py-2 rounded-xl"
            style={{ letterSpacing: "0.18em", background: "rgba(197,245,70,0.1)", color: "var(--spark-lime, #c5f546)", border: "1px dashed rgba(197,245,70,0.35)" }}
          >
            + ANOTHER VISIT AT THIS VENUE
          </button>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time *">
              <TimeSlotSelect value={startTime} onChange={setStartTime} />
            </Field>
            <Field label="End Time *">
              <TimeSlotSelect value={endTime} onChange={setEndTime} />
            </Field>
          </div>
          <Field label="Time Zone *">
            <select value={timezoneId} onChange={(e) => setTimezoneId(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {timeZones.map((tz) => (
                <option key={tz.id} value={tz.id}>{tz.name}</option>
              ))}
            </select>
          </Field>
        </Card>

        {/* Request Type + BA count */}
        <Card title="REQUEST">
          <Field label="Request Type *">
            <select value={requestTypeId} onChange={(e) => setRequestTypeId(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {requestTypes
                .filter((rt) =>
                  [
                    "retail sampling",
                    "event activation",
                    "on-premise sampling",
                    "on-premise",
                  ].includes((rt.name ?? "").toLowerCase()),
                )
                .map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {(rt.name ?? "").toLowerCase() === "on-premise"
                      ? "On-Premise Sampling"
                      : rt.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Brand Ambassadors Needed">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setBaCount(Math.max(1, baCount - 1))} className="w-10 h-10 rounded-xl text-lg" style={{ background: "var(--spark-surface-2, #161a12)", border: "1px solid var(--spark-border, #1f2418)" }}>−</button>
              <span className="display text-2xl font-bold" style={{ minWidth: 40, textAlign: "center" }}>{baCount}</span>
              <button type="button" onClick={() => setBaCount(Math.min(20, baCount + 1))} className="w-10 h-10 rounded-xl text-lg" style={{ background: "var(--spark-surface-2, #161a12)", border: "1px solid var(--spark-border, #1f2418)" }}>+</button>
              <span className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)" }}>BAs</span>
            </div>
          </Field>
        </Card>

        {/* Products */}
        <Card title="PRODUCTS *">
          {productTypes.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              <button
                type="button"
                onClick={() => setSelectedProductTypeId(null)}
                className="mono text-[10px] px-3 py-1.5 rounded-full"
                style={{
                  letterSpacing: "0.18em",
                  background: selectedProductTypeId === null ? "var(--spark-lime, #c5f546)" : "rgba(255,255,255,0.05)",
                  color: selectedProductTypeId === null ? "#0a0d09" : "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                ALL
              </button>
              {productTypes.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setSelectedProductTypeId(pt.id)}
                  className="mono text-[10px] px-3 py-1.5 rounded-full"
                  style={{
                    letterSpacing: "0.18em",
                    background: selectedProductTypeId === pt.id ? "var(--spark-lime, #c5f546)" : "rgba(255,255,255,0.05)",
                    color: selectedProductTypeId === pt.id ? "#0a0d09" : "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {pt.name.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => {
              const selected = productIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className="rounded-2xl overflow-hidden text-left transition"
                  style={{
                    background: selected ? "rgba(197,245,70,0.1)" : "var(--spark-surface-2, #161a12)",
                    border: selected ? "2px solid var(--spark-lime, #c5f546)" : "1px solid var(--spark-border, #1f2418)",
                    boxShadow: selected ? "0 0 18px rgba(197,245,70,0.25)" : "none",
                  }}
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <span className="mono text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>NO IMAGE</span>
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold leading-tight">{p.name}</p>
                    <p className="mono text-[9px] mt-1" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)" }}>
                      {p.productType?.name?.toUpperCase()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {productsLoading && (
            <p className="mono text-[10px] mt-2" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>LOADING…</p>
          )}
          {hasMore && !productsLoading && (
            <button
              type="button"
              onClick={loadMore}
              className="mono text-[10px] px-3 py-2 rounded-xl mt-2"
              style={{ letterSpacing: "0.18em", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              LOAD MORE
            </button>
          )}
        </Card>

        {/* Requestor */}
        <Card title="YOUR INFO">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Your Name *">
              <input
                value={requestorName}
                onChange={(e) => setRequestorName(e.target.value)}
                className={inputCls}
                placeholder="Full name"
                required
              />
            </Field>
            <Field label="Your Email *">
              <input
                type="email"
                value={requestorEmail}
                onChange={(e) => setRequestorEmail(e.target.value)}
                className={inputCls}
                placeholder="you@distributor.com"
                required
              />
            </Field>
          </div>
          <Field label="Distributor (optional)">
            <div className="relative">
              <input
                value={distributorQ}
                onChange={(e) => {
                  setDistributorQ(e.target.value);
                  // Treat any typed text as a free-form name so we still
                  // capture independents — backend dedupes by id where
                  // it matches.
                  setDistributorName(e.target.value);
                  setDistributorId("");
                }}
                className={inputCls}
                placeholder="Start typing — RNDC, Southern Glazer's, Breakthru…"
                autoComplete="off"
              />
              {distributorMatches.length > 0 && distributorQ && !distributorId && (
                <div
                  className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
                  style={{
                    background: "var(--spark-surface, #11140e)",
                    border: "1px solid var(--spark-border, #1f2418)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}
                >
                  {distributorMatches.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDistributorId(String(d.id));
                        setDistributorName(d.name);
                        setDistributorQ(d.name);
                      }}
                      className="block w-full text-left px-3 py-2.5"
                      style={{ color: "var(--spark-text, #f2f3ee)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="text-sm font-semibold">{d.name}</div>
                      {d.location?.state?.name && (
                        <div className="mono text-[10px] mt-0.5" style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>
                          {d.location.state.name.toUpperCase()}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {distributorQ &&
                distributorMatches.length === 0 &&
                !distributorId && (
                  <p
                    className="mono text-[10px] mt-1"
                    style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
                  >
                    NO MATCH — we'll save "{distributorQ}" as typed.
                  </p>
                )}
            </div>
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={3} placeholder="Anything our team should know?" />
          </Field>
        </Card>

        {error && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(239,90,42,0.1)", border: "1px solid rgba(239,90,42,0.4)", color: "var(--spark-orange, #ef5a2a)" }}>
            {error}
          </div>
        )}
        {/* Sticky submit */}
        <div
          className="sticky bottom-0 -mx-1 sm:mx-0 px-3 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "rgba(10,13,9,0.9)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid var(--spark-border, #1f2418)",
          }}
        >
          <div className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)" }}>
            {allDates.length > 1 ? `${allDates.length} VISITS · ${productIds.length} PRODUCTS · ${baCount} BAs` : `${productIds.length} PRODUCTS · ${baCount} BAs`}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime, #c5f546)",
              color: "#0a0d09",
              boxShadow: "0 0 24px rgba(197,245,70,0.4)",
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {submitting ? "Submitting…" : allDates.length > 1 ? `Submit ${allDates.length} Requests` : "Submit Request"}
          </button>
        </div>
      </form>

      {/* Submission-success modal. Routed-to RMM name pulled from the
          createRequestByUrl response. */}
      {confirmation && (
        <div
          onClick={() => setConfirmation(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "#11140e",
              border: "1px solid var(--spark-border, #1f2418)",
              boxShadow:
                "0 60px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(214,243,95,0.15), 0 0 80px rgba(214,243,95,0.10)",
            }}
          >
            {/* Lime status band */}
            <div
              style={{
                padding: "14px 22px",
                background: "rgba(214,243,95,0.10)",
                borderBottom: "1px solid rgba(214,243,95,0.25)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#D6F35F",
                  boxShadow: "0 0 12px #D6F35F",
                  animation: "spk-pulse 1.6s infinite",
                }}
              />
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.24em",
                  color: "#D6F35F",
                }}
              >
                REQUEST RECEIVED · PENDING APPROVAL
              </span>
            </div>

            <div className="p-6">
              <h2
                className="display text-2xl font-bold"
                style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                Thanks, {confirmation.requestorName}.
              </h2>
              <p
                className="text-sm mt-3"
                style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
              >
                {confirmation.count === 1
                  ? "Your request has been submitted."
                  : `${confirmation.count} requests have been submitted.`}{" "}
                {confirmation.routedTo ? (
                  <>
                    They've been routed to{" "}
                    <strong style={{ color: "var(--spark-lime, #c5f546)" }}>
                      {confirmation.routedTo}
                    </strong>{" "}
                    for review.
                  </>
                ) : (
                  <>It's been routed to the {brandName} RMM for review.</>
                )}
              </p>

              <div
                className="mt-5 rounded-xl p-4 space-y-1.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  WHAT HAPPENS NEXT
                </p>
                <ol
                  className="text-sm space-y-1.5 mt-2"
                  style={{
                    paddingLeft: 18,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.55,
                  }}
                >
                  <li>The brand reviews and approves or declines.</li>
                  <li>You'll get an email the moment a decision is made.</li>
                  <li>
                    If approved, a calendar invite goes to you and the brand
                    POC automatically.
                  </li>
                </ol>
              </div>

              <p
                className="mono text-[10px] mt-4 text-center"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                MOST APPROVALS COME THROUGH WITHIN 24–48 HOURS
              </p>

              <button
                onClick={() => setConfirmation(null)}
                className="mt-5 w-full px-5 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime, #c5f546)",
                  color: "#0a0d09",
                  boxShadow: "0 0 24px rgba(197,245,70,0.4)",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </SparkFormLayout>
  );
}

const inputCls =
  "w-full rounded-lg px-3 py-2 text-[15px] focus:outline-none focus:ring-2 spark-input";

// Time-slot picker moved to a shared component used here + on the
// internal /requests/create form. Local thin wrapper keeps the
// inputCls binding so the visual styling stays in sync with the rest
// of this form.
const TimeSlotSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <SharedTimeSlotSelect
    value={value}
    onChange={onChange}
    className={inputCls}
  />
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span
      className="mono text-[9px] block mb-1"
      style={{
        letterSpacing: "0.16em",
        color: "rgba(255,255,255,0.5)",
      }}
    >
      {label.toUpperCase()}
    </span>
    {children}
  </label>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    className="rounded-xl px-4 py-3 space-y-2"
    style={{
      background: "rgba(17,20,14,0.7)",
      border: "1px solid var(--spark-border, #1f2418)",
      backdropFilter: "blur(8px)",
    }}
  >
    <p
      className="mono text-[10px]"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-lime, #c5f546)",
      }}
    >
      {title}
    </p>
    {children}
  </div>
);
