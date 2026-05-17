import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { CreateRequestMutation } from "@/api/mutations/RequestMutation";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";

/**
 * Spark v2 — minimal "Express" request form.
 * Wireframe: spark-demo/request-form.html Express mode (6 fields).
 *
 * A single-page form that collects only the essentials, synthesizes safe
 * defaults for the rest, and auto-assigns to the first available RMM so
 * the request lands in the right approval queue.
 *
 * The previous comprehensive form is preserved at /requests/create-detailed
 * for cases that need product/distributor/store-manager detail.
 */

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.75rem 0.95rem",
  color: "var(--spark-text)",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%",
  fontFamily: "Space Grotesk, sans-serif",
};

const SparkRequestInner: React.FC = () => {
  const { user, tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const navigate = useNavigate();

  const [commit, isCommitting] = useMutation<RequestMutation>(
    CreateRequestMutation,
  );

  // Catalog queries — minimal set to satisfy the required mutation fields.
  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId: tenantId ?? "" } },
    { fetchPolicy: "store-or-network" },
  );
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const rmmData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-or-network" },
  );
  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    {
      first: 60,
      filters: { tenantId: tenantId ?? "" },
    },
    { fetchPolicy: "store-or-network" },
  );

  // Pull existing requests so we can offer type-ahead venue suggestions
  // for the 80%+ of activations that repeat at known addresses.
  const recentRequestsData = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: 500,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const venueIndex = useMemo(() => {
    const seen = new Map<
      string,
      { name: string; address: string; count: number; lastDate: string }
    >();
    const edges = recentRequestsData?.requests?.edges ?? [];
    for (const e of edges) {
      const n = e?.node;
      if (!n) continue;
      const name = n.retailer?.name ?? n.name ?? "";
      if (!name) continue;
      const addr = n.address ?? "";
      const key = `${name.toLowerCase()}|${addr.toLowerCase()}`;
      const existing = seen.get(key);
      const date = n.date ?? "";
      if (!existing) {
        seen.set(key, { name, address: addr, count: 1, lastDate: date });
      } else {
        existing.count += 1;
        if (date > existing.lastDate) existing.lastDate = date;
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count);
  }, [recentRequestsData]);

  const requestTypes = useMemo(
    () =>
      requestTypesData?.requestTypes?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [requestTypesData],
  );
  const timezones = useMemo(
    () =>
      timezonesData?.timezones?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [timezonesData],
  );
  const rmms = useMemo(
    () => (rmmData?.rmmClients ?? []).filter(Boolean),
    [rmmData],
  );
  const products = useMemo(
    () =>
      productsData?.products?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [productsData],
  );

  // Form state
  const [fullName, setFullName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(" "),
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("16:00");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [requestTypeId, setRequestTypeId] = useState("");
  const [timezoneId, setTimezoneId] = useState("");
  const [rmmId, setRmmId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  // Apple-style progressive disclosure: hero fields visible, rest expand.
  const [showDetail, setShowDetail] = useState(false);
  // Venue type-ahead state.
  const [venueFocused, setVenueFocused] = useState(false);

  const venueMatches = useMemo(() => {
    const q = venue.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return venueIndex
      .filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [venue, venueIndex]);

  // Pick sensible defaults once the catalog loads.
  useEffect(() => {
    if (!requestTypeId && requestTypes[0]) {
      setRequestTypeId(String(requestTypes[0].id));
    }
    if (!timezoneId && timezones[0]) {
      // Default to America/Chicago if present, else first.
      const chicago = timezones.find((t) =>
        (t?.name ?? "").includes("Chicago"),
      );
      setTimezoneId(String((chicago ?? timezones[0])?.id));
    }
    if (!rmmId && rmms[0]) {
      setRmmId(String(rmms[0].id));
    }
  }, [requestTypes, timezones, rmms, requestTypeId, timezoneId, rmmId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !venue || !requestTypeId || !timezoneId) {
      showAlert("Fill in venue, date, time, and type.", "warning");
      return;
    }
    const composedName = `${venue} · ${date}`;
    commit({
      variables: {
        input: {
          name: composedName,
          address: address || venue,
          coordinates: [0, 0],
          date,
          startTime,
          endTime,
          timezoneId,
          requestTypeId,
          rmmAsignedId: rmmId || undefined,
          tenantId: tenantId ?? undefined,
          clientName: fullName || undefined,
          clientEmail: email || undefined,
          requestorEmail: email || undefined,
          notes: notes || undefined,
          details: [],
          products: Array.from(selectedProducts).map((productId) => ({
            productId,
            quantity: 1,
          })),
        },
      },
      onCompleted: (res) => {
        if (res.createRequest?.success) {
          showAlert(
            "Request submitted. Auto-routed to your RMM for approval.",
            "success",
          );
          navigate("/requests/list");
        } else {
          showAlert(
            res.createRequest?.message ?? "Couldn't submit the request.",
            "error",
          );
        }
      },
      onError: (err) =>
        showAlert(`Submit failed: ${err.message}`, "error"),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          NEW REQUEST · EXPRESS MODE
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Tell us about the visit.
        </h1>
        <p
          className="mt-2"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Six fields. We auto-route to your Ignite RMM for approval,
          staffing, and scheduling.
        </p>
      </div>

      {/* Card */}
      <div className="spark-card p-6 lg:p-8 space-y-6" style={{ paddingBottom: "6rem" }}>
        {/* HERO — 3 fields visible by default. Everything else collapses. */}
        <div className="space-y-5">
          <div className="relative">
            <label className="label-mini block mb-1.5">Venue *</label>
            <input
              style={inputStyle}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              onFocus={() => setVenueFocused(true)}
              onBlur={() =>
                // Delay so click on a suggestion lands first
                setTimeout(() => setVenueFocused(false), 150)
              }
              placeholder="Start typing… we'll suggest repeat venues"
              required
              autoComplete="off"
            />
            {venueFocused && venueMatches.length > 0 && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 rounded-xl overflow-hidden"
                style={{
                  background: "var(--spark-surface)",
                  border: "1px solid var(--spark-border)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {venueMatches.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setVenue(v.name);
                      if (v.address) setAddress(v.address);
                      setVenueFocused(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(197,245,70,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.address && (
                        <p
                          className="text-xs truncate"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          {v.address}
                        </p>
                      )}
                    </div>
                    <span
                      className="mono shrink-0"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: "var(--spark-lime)",
                      }}
                    >
                      ×{v.count} REQUESTS
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-mini block mb-1.5">Date *</label>
              <input
                style={inputStyle}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Activation type *</label>
              <select
                style={inputStyle}
                value={requestTypeId}
                onChange={(e) => setRequestTypeId(e.target.value)}
                required
              >
                <option value="">Select type</option>
                {requestTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-routed RMM display + Change inline (no dropdown by default) */}
          <div
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl"
            style={{
              background: "rgba(197,245,70,0.06)",
              border: "1px solid rgba(197,245,70,0.25)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "var(--spark-lime)",
                }}
              >
                ROUTING →
              </span>
              <p className="text-sm truncate">
                {(() => {
                  const r = rmms.find((m) => String(m?.id) === rmmId);
                  return r
                    ? [r.firstName, r.lastName].filter(Boolean).join(" ") ||
                        r.username
                    : "First available RMM";
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="mono text-[10px] transition shrink-0"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              CHANGE
            </button>
          </div>
        </div>

        {/* DETAIL — collapsed until "Add detail" */}
        {!showDetail && (
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="w-full py-3 rounded-xl text-sm transition"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.55)",
              border: "1px dashed var(--spark-border)",
            }}
          >
            + Add detail (time, requestor, products, notes, RMM)
          </button>
        )}

        {showDetail && (
          <div
            className="space-y-5 pt-5"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-mini block mb-1.5">Your name</label>
                <input
                  style={inputStyle}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="label-mini block mb-1.5">Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@distributor.com"
                />
              </div>
            </div>

            <div>
              <label className="label-mini block mb-1.5">Address</label>
              <input
                style={inputStyle}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label-mini block mb-1.5">Start time</label>
                <input
                  style={inputStyle}
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label-mini block mb-1.5">End time</label>
                <input
                  style={inputStyle}
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label-mini block mb-1.5">Time zone</label>
                <select
                  style={inputStyle}
                  value={timezoneId}
                  onChange={(e) => setTimezoneId(e.target.value)}
                >
                  <option value="">Select timezone</option>
                  {timezones.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-mini block mb-1.5">
                Routes to RMM (auto-approval)
              </label>
              <select
                style={inputStyle}
                value={rmmId}
                onChange={(e) => setRmmId(e.target.value)}
              >
                <option value="">First available RMM</option>
                {rmms.map((r) =>
                  r ? (
                    <option key={r.id} value={r.id}>
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") ||
                        r.username}
                    </option>
                  ) : null,
                )}
              </select>
            </div>
          </div>
        )}

        {/* Products picker */}
        {products.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-mini">
                Products to sample · {selectedProducts.size} selected
              </label>
              {selectedProducts.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProducts(new Set())}
                  className="mono text-[10px] transition"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  × CLEAR
                </button>
              )}
            </div>
            <div
              className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2"
              style={{ maxHeight: 280, overflowY: "auto" }}
            >
              {products.map((p) => {
                const on = selectedProducts.has(String(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedProducts((prev) => {
                        const next = new Set(prev);
                        const id = String(p.id);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="aspect-square rounded-xl relative overflow-hidden transition"
                    style={{
                      background: on
                        ? "rgba(197,245,70,0.10)"
                        : "rgba(255,255,255,0.025)",
                      border: on
                        ? "2px solid var(--spark-lime)"
                        : "1px solid var(--spark-border)",
                      boxShadow: on
                        ? "0 0 18px rgba(197,245,70,0.25)"
                        : "none",
                    }}
                    title={p.name}
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-contain p-2"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {p.name?.slice(0, 14)}
                        </span>
                      </div>
                    )}
                    {on && (
                      <span
                        className="absolute top-1 right-1 w-5 h-5 rounded-full grid place-items-center font-bold"
                        style={{
                          background: "var(--spark-lime)",
                          color: "#0a0d09",
                          fontSize: 12,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="label-mini block mb-1.5">Notes (optional)</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the captain should know. Sampling cadence, store contact, special asks."
          />
        </div>

      </div>

      {/* Routing footer */}
      <div
        className="spark-card p-5"
        style={{
          borderColor: "rgba(197,245,70,0.25)",
          background:
            "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
        }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-lime)",
          }}
        >
          WHAT HAPPENS NEXT
        </p>
        <p
          className="mt-2 text-sm"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          Submission lands in the RMM's queue. Once approved, Spark auto-posts
          a job and emails confirmation to your team.
        </p>
      </div>

      {/* Sticky submit bar — always in view */}
      <div
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          background: "rgba(10,13,9,0.92)",
          backdropFilter: "blur(14px)",
          borderTop: "1px solid var(--spark-border)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/requests/create-detailed")}
            className="mono text-[10px] transition"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ⛁ DETAILED FORM →
          </button>
          <button
            type="submit"
            disabled={isCommitting || !venue || !date}
            className="px-6 py-3 rounded-2xl text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow:
                !venue || !date
                  ? "none"
                  : "0 0 24px rgba(197,245,70,0.35)",
              opacity: isCommitting || !venue || !date ? 0.5 : 1,
            }}
          >
            {isCommitting ? "Submitting…" : "Submit & route to RMM →"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default function SparkRequestCreate() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-3xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading form…
          </div>
        }
      >
        <SparkRequestInner />
      </Suspense>
    </Layout>
  );
}
