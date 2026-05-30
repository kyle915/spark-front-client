import { Suspense, useEffect, useMemo, useState } from "react";
import {
  useLazyLoadQuery,
  useMutation,
  fetchQuery,
} from "react-relay/hooks";
import Layout from "@/layout/Layout";
import environment from "@/api/relay/environment";
import { ReceiptsQuery } from "@/api/queries/ReceiptsQuery";
import type { ReceiptsQuery as ReceiptsQueryType } from "@api/queries/__generated__/ReceiptsQuery.graphql";
import { ReviewReceiptMutation } from "@/api/mutations/ReviewReceiptMutation";
import type { ReviewReceiptMutation as ReviewReceiptMutationType } from "@api/mutations/__generated__/ReviewReceiptMutation.graphql";
import { EventReceiptUploadLinkQuery } from "@/api/queries/EventReceiptUploadLinkQuery";
import type { EventReceiptUploadLinkQuery as EventReceiptUploadLinkQueryType } from "@api/queries/__generated__/EventReceiptUploadLinkQuery.graphql";
import { RecapEventOptionsQuery } from "@/api/queries/RecapEventOptionsQuery";
import type { RecapEventOptionsQuery as RecapEventOptionsQueryType } from "@api/queries/__generated__/RecapEventOptionsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Consumer Receipt validation queue.
 *
 * Admins review receipts submitted by consumers through the public,
 * no-login upload page. Each receipt carries a photo (publicUrl), the
 * consumer's contact, store / purchase details, and an event link.
 * Reviewing validates or rejects it via reviewReceipt, optionally with
 * a note. The page header also mints per-event public upload links so
 * ops can hand a consumer (or print on signage) the URL that feeds this
 * queue.
 *
 * Visual style mirrors SparkRecapsList (spark-card / chip / mono tokens).
 */

// Server caps the receipts list; we pull one bounded page and filter by
// status with chips. Receipt volume per tenant is bounded (hundreds),
// so a single page keeps the queue simple without a "load more".
const FETCH_ALL = 1000;

// The public upload-page route lives in AppRoutes as /receipt-upload/:token.
// Built from the token returned by eventReceiptUploadLink so the consumer
// page can resolve the event server-side.
const uploadPageUrl = (token: string): string =>
  `${window.location.origin}/receipt-upload/${encodeURIComponent(token)}`;

type StatusKey = "pending" | "validated" | "rejected" | "all";

type Receipt = {
  id: string;
  uuid: string;
  status: string;
  submittedAt: string | null;
  eventId: string | null;
  eventName: string | null;
  consumerName: string | null;
  consumerEmail: string | null;
  consumerPhone: string | null;
  storeName: string | null;
  purchaseDate: string | null;
  amount: string | null;
  product: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  publicUrl: string | null;
  reviewedByName: string | null;
};

const formatDateTime = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const formatDate = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

// Map a status string to a chip tone + label. Unknown statuses fall back
// to a neutral gold so the row still renders something sensible.
const statusChip = (
  status: string,
): { cls: string; label: string } => {
  switch (status) {
    case "validated":
      return { cls: "chip chip-lime", label: "VALIDATED" };
    case "rejected":
      return { cls: "chip chip-orange", label: "REJECTED" };
    case "pending":
      return { cls: "chip chip-gold", label: "PENDING" };
    default:
      return { cls: "chip chip-gold", label: status.toUpperCase() };
  }
};

const inputStyle: React.CSSProperties = {
  padding: "0.75rem 0.95rem",
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
  outline: "none",
};

// ─── Receipt card ──────────────────────────────────────────────────────
const ReceiptCard: React.FC<{
  receipt: Receipt;
  onOpen: () => void;
}> = ({ receipt, onOpen }) => {
  const chip = statusChip(receipt.status);
  return (
    <div
      onClick={onOpen}
      className="spark-card hov overflow-hidden cursor-pointer relative"
    >
      <div
        className="h-40 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
        }}
      >
        {receipt.publicUrl ? (
          <img
            src={receipt.publicUrl}
            alt="Receipt"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-4xl" aria-hidden>
              🧾
            </span>
          </div>
        )}
        <span className={`absolute top-2 right-2 ${chip.cls}`}>
          ● {chip.label}
        </span>
        <span
          className="absolute top-2 left-2 mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.7)",
            background: "rgba(0,0,0,0.45)",
            padding: "2px 6px",
            borderRadius: 999,
          }}
        >
          RC-{receipt.uuid.slice(-4).toUpperCase()}
        </span>
      </div>

      <div className="p-4">
        <p
          className="font-bold text-sm truncate"
          title={receipt.storeName ?? undefined}
        >
          {receipt.storeName || "Unknown store"}
        </p>
        <p
          className="mono text-[10px] uppercase mt-1 truncate"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {receipt.purchaseDate ? formatDate(receipt.purchaseDate) : "—"}
          {receipt.amount ? ` · ${receipt.amount}` : ""}
          {receipt.product ? ` · ${receipt.product}` : ""}
        </p>

        {receipt.eventName && (
          <p
            className="mono inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px] max-w-full truncate"
            style={{
              letterSpacing: "0.12em",
              background: "rgba(95,184,239,0.10)",
              border: "1px solid rgba(95,184,239,0.30)",
              color: "var(--spark-sky)",
            }}
            title={receipt.eventName}
          >
            ◇ {receipt.eventName}
          </p>
        )}

        <div
          className="mt-3 pt-3 text-xs"
          style={{
            borderTop: "1px solid var(--spark-border)",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          <p className="truncate">{receipt.consumerName || "Anonymous"}</p>
          <p
            className="truncate"
            style={{ color: "rgba(255,255,255,0.45)" }}
            title={receipt.consumerEmail || receipt.consumerPhone || undefined}
          >
            {receipt.consumerEmail || receipt.consumerPhone || "—"}
          </p>
          {receipt.submittedAt && (
            <p
              className="mono mt-1"
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {formatDateTime(receipt.submittedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Detail modal ──────────────────────────────────────────────────────
const ReceiptDetailModal: React.FC<{
  receipt: Receipt;
  onClose: () => void;
  onReviewed: (updated: { status: string; reviewNote: string | null }) => void;
}> = ({ receipt, onClose, onReviewed }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [note, setNote] = useState(receipt.reviewNote ?? "");
  const [commit, inFlight] = useMutation<ReviewReceiptMutationType>(
    ReviewReceiptMutation,
  );

  const review = (status: "validated" | "rejected") => {
    if (inFlight) return;
    commit({
      variables: {
        input: {
          id: receipt.id,
          status,
          note: note.trim() ? note.trim() : null,
        },
      },
      onCompleted: (res) => {
        const payload = res.reviewReceipt;
        if (payload?.success) {
          showAlert(
            payload.message ||
              `Receipt ${status === "validated" ? "validated" : "rejected"}.`,
            "success",
          );
          onReviewed({
            status: payload.receipt?.status ?? status,
            reviewNote: payload.receipt?.reviewNote ?? (note.trim() || null),
          });
          onClose();
        } else {
          showAlert(payload?.message ?? "Receipt review failed.", "error");
        }
      },
      onError: (err) =>
        showAlert(`Receipt review failed: ${err.message}`, "error"),
    });
  };

  const chip = statusChip(receipt.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="spark-card w-full max-w-3xl my-8"
        style={{ background: "var(--spark-surface, #0f1310)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              RC-{receipt.uuid.slice(-4).toUpperCase()}
            </span>
            <span className={chip.cls}>● {chip.label}</span>
          </div>
          <button
            onClick={onClose}
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image side */}
          <div
            className="p-4 flex flex-col gap-3"
            style={{ borderRight: "1px solid var(--spark-border)" }}
          >
            <div
              className="rounded-xl overflow-hidden grid place-items-center"
              style={{
                minHeight: 280,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {receipt.publicUrl ? (
                <img
                  src={receipt.publicUrl}
                  alt="Receipt"
                  className="w-full h-auto object-contain"
                />
              ) : (
                <span style={{ color: "rgba(255,255,255,0.4)" }}>
                  No image
                </span>
              )}
            </div>
            {receipt.publicUrl && (
              <a
                href={receipt.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-center"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                ↗ Open image in new tab
              </a>
            )}
          </div>

          {/* Fields side */}
          <div className="p-4 space-y-3">
            <Field label="Store" value={receipt.storeName} />
            <Field
              label="Purchase date"
              value={
                receipt.purchaseDate ? formatDate(receipt.purchaseDate) : null
              }
            />
            <Field label="Amount" value={receipt.amount} />
            <Field label="Product" value={receipt.product} />
            <Field label="Event" value={receipt.eventName} />
            <div
              className="pt-3"
              style={{ borderTop: "1px solid var(--spark-border)" }}
            >
              <Field label="Consumer" value={receipt.consumerName} />
              <Field label="Email" value={receipt.consumerEmail} />
              <Field label="Phone" value={receipt.consumerPhone} />
            </div>
            <Field
              label="Submitted"
              value={formatDateTime(receipt.submittedAt) || null}
            />
            {receipt.reviewedAt && (
              <Field
                label="Reviewed"
                value={`${formatDateTime(receipt.reviewedAt)}${
                  receipt.reviewedByName ? ` · ${receipt.reviewedByName}` : ""
                }`}
              />
            )}
          </div>
        </div>

        {/* Review controls */}
        <div
          className="px-6 py-4 space-y-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <label className="label-mini block">REVIEW NOTE (OPTIONAL)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add a reason — shown back on the receipt (e.g. wrong product, blurry photo)."
            className="w-full rounded-xl text-sm"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={() => review("rejected")}
              disabled={inFlight}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "rgba(239,90,42,0.12)",
                color: "var(--spark-orange)",
                border: "1px solid rgba(239,90,42,0.5)",
              }}
            >
              {inFlight ? "Working…" : "✕ Reject"}
            </button>
            <button
              type="button"
              onClick={() => review("validated")}
              disabled={inFlight}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 18px rgba(197,245,70,0.4)",
              }}
            >
              {inFlight ? "Working…" : "✓ Validate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string | null | undefined }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-1">
    <span className="label-mini sm:w-28 shrink-0">{label}</span>
    <span className="text-sm" style={{ color: "var(--spark-text)" }}>
      {value || "—"}
    </span>
  </div>
);

// ─── Upload-link generator (event picker + copyable URL) ───────────────
const UploadLinkPanel: React.FC<{ tenantId: string | null }> = ({
  tenantId,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<RecapEventOptionsQueryType>(
    RecapEventOptionsQuery,
    { tenantId, first: 500 },
    { fetchPolicy: "store-or-network" },
  );
  const events = useMemo(
    () =>
      (data?.recapEventOptions?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );

  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getLink = () => {
    if (!eventId || loading) return;
    setLoading(true);
    setLink(null);
    setCopied(false);
    fetchQuery<EventReceiptUploadLinkQueryType>(
      environment,
      EventReceiptUploadLinkQuery,
      { eventId },
    ).subscribe({
      next: (res) => {
        const token = res?.eventReceiptUploadLink?.token;
        if (token) {
          setLink(uploadPageUrl(token));
        } else {
          showAlert("Could not generate an upload link for that event.", "error");
        }
      },
      error: (err: Error) => {
        showAlert(`Upload link failed: ${err.message}`, "error");
        setLoading(false);
      },
      complete: () => setLoading(false),
    });
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("Couldn't reach the clipboard — copy the link manually.", "warning");
    }
  };

  return (
    <div className="spark-card p-4 space-y-3">
      <p className="label-mini">CONSUMER UPLOAD LINK</p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
        Pick an event to mint a public, no-login receipt-upload link. Share it
        with consumers or print it on signage — submissions land in this queue.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setLink(null);
          }}
          className="rounded-xl text-sm"
          style={{ ...inputStyle, minWidth: 220, maxWidth: 320 }}
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name || "Untitled event"}
              {ev.date ? ` · ${formatDate(ev.date)}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={getLink}
          disabled={!eventId || loading}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 16px rgba(197,245,70,0.3)",
          }}
        >
          {loading ? "Generating…" : "Get upload link"}
        </button>
      </div>
      {link && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-xl text-sm flex-1"
            style={{ ...inputStyle, minWidth: 240 }}
          />
          <button
            type="button"
            onClick={copy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: copied ? "rgba(95,184,239,0.18)" : "transparent",
              color: copied ? "var(--spark-sky)" : "var(--spark-text)",
              border: `1px solid ${
                copied ? "rgba(95,184,239,0.5)" : "var(--spark-border)"
              }`,
            }}
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ↗ Open
          </a>
        </div>
      )}
    </div>
  );
};

// ─── List (suspends on the receipts query) ─────────────────────────────
const ReceiptsListInner: React.FC<{
  tenantId: string | null;
  statusFilter: StatusKey;
  eventFilter: string;
  onOpen: (r: Receipt) => void;
  onMeta: (m: { total: number; events: { id: string; name: string }[] }) => void;
  // Local status overrides keyed by receipt id, applied after a review so
  // the row reflects the new status without a refetch.
  overrides: Record<string, { status: string; reviewNote: string | null }>;
}> = ({ tenantId, statusFilter, eventFilter, onOpen, onMeta, overrides }) => {
  const data = useLazyLoadQuery<ReceiptsQueryType>(
    ReceiptsQuery,
    {
      first: FETCH_ALL,
      filters: {
        tenantId,
        status: statusFilter === "all" ? null : statusFilter,
        eventId: eventFilter === "all" ? null : eventFilter,
      },
    },
    { fetchPolicy: "store-or-network" },
  );

  const receipts: Receipt[] = useMemo(() => {
    const rows =
      data?.receipts?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const ov = overrides[String(n.id)];
          const reviewedByName =
            [n.reviewedBy?.firstName, n.reviewedBy?.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            n.reviewedBy?.email ||
            null;
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            status: ov?.status ?? n.status,
            submittedAt: n.submittedAt ?? null,
            eventId: n.eventId != null ? String(n.eventId) : null,
            eventName: n.eventName ?? null,
            consumerName: n.consumerName ?? null,
            consumerEmail: n.consumerEmail ?? null,
            consumerPhone: n.consumerPhone ?? null,
            storeName: n.storeName ?? null,
            purchaseDate: n.purchaseDate ?? null,
            amount: n.amount ?? null,
            product: n.product ?? null,
            reviewNote: ov?.reviewNote ?? n.reviewNote ?? null,
            reviewedAt: n.reviewedAt ?? null,
            publicUrl: n.publicUrl ?? null,
            reviewedByName,
          } satisfies Receipt;
        }) ?? [];
    return rows;
  }, [data, overrides]);

  // Publish total + event options up to the chrome for the header counter
  // and the event filter dropdown.
  const total = data?.receipts?.totalCount ?? 0;
  useEffect(() => {
    const eventMap = new Map<string, string>();
    for (const r of receipts) {
      if (r.eventId) eventMap.set(r.eventId, r.eventName || r.eventId);
    }
    onMeta({
      total,
      events: Array.from(eventMap.entries()).map(([id, name]) => ({
        id,
        name,
      })),
    });
  }, [receipts, total, onMeta]);

  if (receipts.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        No receipts match these filters.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {receipts.map((r) => (
        <ReceiptCard key={r.uuid} receipt={r} onOpen={() => onOpen(r)} />
      ))}
    </div>
  );
};

const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "validated", label: "Validated" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function SparkReceipts() {
  const { tenantId } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<StatusKey>("pending");
  const [eventFilter, setEventFilter] = useState("all");
  const [active, setActive] = useState<Receipt | null>(null);
  const [meta, setMeta] = useState<{
    total: number;
    events: { id: string; name: string }[];
  }>({ total: 0, events: [] });
  // Status overrides applied after a review, keyed by receipt id, so the
  // queue updates in place without a refetch.
  const [overrides, setOverrides] = useState<
    Record<string, { status: string; reviewNote: string | null }>
  >({});

  const onMeta = useMemo(
    () =>
      (m: { total: number; events: { id: string; name: string }[] }) =>
        setMeta(m),
    [],
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              RECEIPTS · {meta.total} TOTAL
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Validate receipts.
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Consumer-submitted receipts awaiting your review — validate or
              reject each with a photo, store, and contact details.
            </p>
          </div>
        </div>

        {/* Per-event upload link generator */}
        <Suspense
          fallback={
            <div
              className="spark-card p-4 text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading events…
            </div>
          }
        >
          <UploadLinkPanel tenantId={tenantId} />
        </Suspense>

        {/* Filters */}
        <div className="spark-card p-4 flex flex-wrap gap-3 items-center">
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((s) => {
              const on = statusFilter === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: on ? "var(--spark-lime)" : "transparent",
                    color: on ? "#0a0d09" : "var(--spark-text)",
                    border: `1px solid ${
                      on ? "var(--spark-lime)" : "var(--spark-border)"
                    }`,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {meta.events.length > 0 && (
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-xl text-sm"
              style={{ ...inputStyle, maxWidth: 260, marginLeft: "auto" }}
              title="Filter by event"
            >
              <option value="all">All events</option>
              {meta.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading receipts…
            </div>
          }
        >
          <ReceiptsListInner
            tenantId={tenantId}
            statusFilter={statusFilter}
            eventFilter={eventFilter}
            onOpen={setActive}
            onMeta={onMeta}
            overrides={overrides}
          />
        </Suspense>
      </div>

      {active && (
        <ReceiptDetailModal
          receipt={active}
          onClose={() => setActive(null)}
          onReviewed={(updated) =>
            setOverrides((prev) => ({
              ...prev,
              [active.id]: updated,
            }))
          }
        />
      )}
    </Layout>
  );
}
