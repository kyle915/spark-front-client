import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { InvoicesQuery } from "@/api/queries/InvoicesQuery";
import type {
  InvoicesQuery as InvoicesQueryType,
  InvoicesQuery$data,
} from "@api/queries/__generated__/InvoicesQuery.graphql";
import { CreateInvoiceMutation } from "@/api/mutations/CreateInvoiceMutation";
import type { CreateInvoiceMutation as CreateInvoiceMutationType } from "@api/mutations/__generated__/CreateInvoiceMutation.graphql";
import { UpdateInvoiceMutation } from "@/api/mutations/UpdateInvoiceMutation";
import type { UpdateInvoiceMutation as UpdateInvoiceMutationType } from "@api/mutations/__generated__/UpdateInvoiceMutation.graphql";
import { SetInvoiceStatusMutation } from "@/api/mutations/SetInvoiceStatusMutation";
import type { SetInvoiceStatusMutation as SetInvoiceStatusMutationType } from "@api/mutations/__generated__/SetInvoiceStatusMutation.graphql";
import { DeleteInvoiceMutation } from "@/api/mutations/DeleteInvoiceMutation";
import type { DeleteInvoiceMutation as DeleteInvoiceMutationType } from "@api/mutations/__generated__/DeleteInvoiceMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Billing.
 *
 * The working invoicing tool: list invoices, create/edit one with a
 * line-item editor, transition status (draft → sent → paid / void),
 * delete, copy a client share link, and download a PDF. The public,
 * no-login twin of an invoice lives at /invoice/:token (PublicInvoice).
 *
 * Spark itself never moves money — "Mark paid" just records that a
 * payment landed out-of-band, mirroring how Receipts records Venmo
 * payouts. Visual style mirrors SparkReceipts (spark-card / chip / mono
 * tokens) — dark theme, lime accent.
 */

type Invoice = InvoicesQuery$data["invoices"][number];
type LineItem = Invoice["lineItems"][number];

// Public client share link for an invoice — the no-login invoice page.
const invoiceShareUrl = (token: string): string =>
  `${window.location.origin}/invoice/${token}`;

// Derive the REST API origin from the GraphQL endpoint env var (scheme +
// host), exactly like the public pages. The PDF is served off this origin.
function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

const invoicePdfUrl = (token: string): string =>
  `${apiOrigin()}/api/public/invoice/${encodeURIComponent(token)}/pdf`;

// Status filter tabs. "all" drops the status filter entirely.
type StatusFilter = "all" | "draft" | "sent" | "paid" | "void";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

const formatDate = (raw: string | null | undefined): string => {
  if (!raw) return "—";
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

// Parse a money-ish string ("12.50", "$12.50") to a finite number, else 0.
const num = (raw: string | null | undefined): number => {
  if (raw == null) return 0;
  const n = Number(String(raw).trim().replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Render a numeric amount with the invoice currency (ISO code → symbol via
// Intl, falling back to the raw code prefix for anything Intl rejects).
const formatMoney = (amount: number, currency: string): string => {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
};

// Map a status string to a chip tone + label.
const statusChip = (status: string): { cls: string; label: string } => {
  switch (status) {
    case "paid":
      return { cls: "chip chip-lime", label: "PAID" };
    case "sent":
      return { cls: "chip chip-sky", label: "SENT" };
    case "void":
      return { cls: "chip chip-orange", label: "VOID" };
    case "draft":
      return { cls: "chip chip-gold", label: "DRAFT" };
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

const limeButton: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "#0a0d09",
  boxShadow: "0 0 16px rgba(197,245,70,0.3)",
};

const ghostButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

// Subtle-red, used for the destructive Delete action so it reads as
// dangerous without shouting.
const dangerButton: React.CSSProperties = {
  background: "rgba(239,90,42,0.12)",
  color: "var(--spark-orange)",
  border: "1px solid rgba(239,90,42,0.5)",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="label-mini block mb-1.5">{label}</label>
    {children}
  </div>
);

// ─── Copyable client share link ────────────────────────────────────────
const ShareLink: React.FC<{ token: string }> = ({ token }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const url = invoiceShareUrl(token);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert(
        "Couldn't reach the clipboard — copy the link manually.",
        "warning",
      );
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="mono text-[11px] disabled:opacity-40"
      style={{
        letterSpacing: "0.12em",
        color: copied ? "var(--spark-sky)" : "rgba(255,255,255,0.6)",
      }}
      title={url}
    >
      {copied ? "✓ LINK COPIED" : "🔗 COPY CLIENT LINK"}
    </button>
  );
};

// ─── Confirm dialog ────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  title,
  body,
  confirmLabel,
  busy,
  tone = "default",
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    onClick={onCancel}
  >
    <div
      className="spark-card w-full max-w-sm"
      style={{ background: "var(--spark-surface, #0f1310)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6">
        <h2 className="display text-lg font-bold">{title}</h2>
        <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          {body}
        </div>
      </div>
      <div
        className="px-6 py-4 flex justify-end gap-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={ghostButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={tone === "danger" ? dangerButton : limeButton}
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Line-item editor ──────────────────────────────────────────────────
// An editable row: description, qty, unit price → live amount. The parent
// owns the rows; this just renders + reports edits, plus a running
// subtotal/tax/total summary below.
type DraftLine = {
  // A stable client-side key so React keeps inputs focused across edits.
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  eventId: string | null;
};

let lineSeq = 0;
const newLine = (): DraftLine => ({
  key: `l${++lineSeq}`,
  description: "",
  quantity: "1",
  unitPrice: "",
  eventId: null,
});

const lineAmount = (l: DraftLine): number => num(l.quantity) * num(l.unitPrice);

const LineItemEditor: React.FC<{
  lines: DraftLine[];
  currency: string;
  taxRate: string;
  onChange: (lines: DraftLine[]) => void;
}> = ({ lines, currency, taxRate, onChange }) => {
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));
  const add = () => onChange([...lines, newLine()]);

  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const taxPct = num(taxRate);
  const taxAmount = subtotal * (taxPct / 100);
  const total = subtotal + taxAmount;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label-mini">Line items</label>
        <button
          type="button"
          onClick={add}
          className="mono text-[11px]"
          style={{ letterSpacing: "0.12em", color: "var(--spark-lime)" }}
        >
          + ADD ROW
        </button>
      </div>

      {/* Header row (hidden on small screens) */}
      <div
        className="hidden sm:grid gap-2 px-1 pb-1.5 mono text-[10px] uppercase"
        style={{
          gridTemplateColumns: "1fr 80px 110px 110px 28px",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="space-y-2">
        {lines.map((l) => (
          <div
            key={l.key}
            className="grid gap-2 items-center"
            style={{ gridTemplateColumns: "1fr 80px 110px 110px 28px" }}
          >
            <input
              type="text"
              value={l.description}
              onChange={(e) => update(l.key, { description: e.target.value })}
              placeholder="e.g. Field activation — 4 events"
              className="w-full rounded-xl text-sm col-span-full sm:col-span-1"
              style={inputStyle}
            />
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={l.quantity}
              onChange={(e) => update(l.key, { quantity: e.target.value })}
              placeholder="1"
              aria-label="Quantity"
              className="w-full rounded-xl text-sm text-right"
              style={inputStyle}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={l.unitPrice}
              onChange={(e) => update(l.key, { unitPrice: e.target.value })}
              placeholder="0.00"
              aria-label="Unit price"
              className="w-full rounded-xl text-sm text-right"
              style={inputStyle}
            />
            <span
              className="mono text-sm text-right tabular-nums px-1"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              {formatMoney(lineAmount(l), currency)}
            </span>
            <button
              type="button"
              onClick={() => remove(l.key)}
              aria-label="Remove line item"
              title="Remove line"
              className="text-center"
              style={{ color: "var(--spark-orange)", fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}
        {lines.length === 0 && (
          <p
            className="text-xs py-3 text-center rounded-xl"
            style={{
              color: "rgba(255,255,255,0.45)",
              border: "1px dashed var(--spark-border)",
            }}
          >
            No line items yet. Add a row to start.
          </p>
        )}
      </div>

      {/* Running totals */}
      <div
        className="mt-3 pt-3 space-y-1.5"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <TotalRow label="Subtotal" value={formatMoney(subtotal, currency)} />
        <TotalRow
          label={`Tax (${taxPct || 0}%)`}
          value={formatMoney(taxAmount, currency)}
        />
        <TotalRow label="Total" value={formatMoney(total, currency)} strong />
      </div>
    </div>
  );
};

const TotalRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between">
    <span
      className={strong ? "text-sm font-bold" : "text-sm"}
      style={{ color: strong ? "var(--spark-text)" : "rgba(255,255,255,0.6)" }}
    >
      {label}
    </span>
    <span
      className={`mono tabular-nums ${strong ? "text-base font-bold" : "text-sm"}`}
      style={{ color: strong ? "var(--spark-lime)" : "rgba(255,255,255,0.8)" }}
    >
      {value}
    </span>
  </div>
);

// ─── Invoice create / edit modal ───────────────────────────────────────
const InvoiceFormModal: React.FC<{
  tenantId: string | null;
  existing: Invoice | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ tenantId, existing, onClose, onSaved }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [issueDate, setIssueDate] = useState(existing?.issueDate ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [taxRate, setTaxRate] = useState(
    existing ? stripPct(existing.taxRate) : "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (existing && existing.lineItems.length > 0) {
      return [...existing.lineItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((li: LineItem) => ({
          key: `l${++lineSeq}`,
          description: li.description,
          quantity: stripPct(li.quantity),
          unitPrice: stripPct(li.unitPrice),
          eventId: li.eventId ?? null,
        }));
    }
    return [newLine()];
  });

  const currency = existing?.currency ?? "USD";

  const [createCommit, creating] = useMutation<CreateInvoiceMutationType>(
    CreateInvoiceMutation,
  );
  const [updateCommit, updating] = useMutation<UpdateInvoiceMutationType>(
    UpdateInvoiceMutation,
  );
  const inFlight = creating || updating;

  const save = () => {
    if (inFlight) return;

    // Drop fully-empty rows; a description is the one thing a line needs.
    const filled = lines.filter(
      (l) => l.description.trim() || num(l.quantity) || num(l.unitPrice),
    );
    if (filled.length === 0) {
      showAlert("Add at least one line item.", "warning");
      return;
    }
    const missingDesc = filled.some((l) => !l.description.trim());
    if (missingDesc) {
      showAlert("Every line item needs a description.", "warning");
      return;
    }

    // taxRate is an optional Float (percent). Blank → undefined so the
    // server keeps its default / existing value; a non-numeric value is
    // rejected.
    const taxTrimmed = taxRate.trim();
    const taxNum = taxTrimmed === "" ? undefined : Number(taxTrimmed);
    if (taxNum !== undefined && !Number.isFinite(taxNum)) {
      showAlert("Tax rate must be a number (e.g. 8.5).", "warning");
      return;
    }

    const lineItems = filled.map((l) => ({
      description: l.description.trim(),
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      eventId: l.eventId || null,
    }));

    if (existing) {
      updateCommit({
        variables: {
          input: {
            id: existing.id,
            issueDate: issueDate.trim() || null,
            dueDate: dueDate.trim() || null,
            notes: notes.trim() || null,
            taxRate: taxNum ?? null,
            lineItems,
          },
        },
        onCompleted: (res) => {
          const payload = res.updateInvoice;
          if (payload?.success) {
            showAlert(payload.message || "Invoice updated.", "success");
            onSaved();
            onClose();
          } else {
            showAlert(payload?.message ?? "Couldn't update the invoice.", "error");
          }
        },
        onError: (err) => showAlert(`Update failed: ${err.message}`, "error"),
      });
    } else {
      createCommit({
        variables: {
          input: {
            tenantId,
            issueDate: issueDate.trim() || null,
            dueDate: dueDate.trim() || null,
            notes: notes.trim() || null,
            taxRate: taxNum ?? null,
            lineItems,
          },
        },
        onCompleted: (res) => {
          const payload = res.createInvoice;
          if (payload?.success) {
            showAlert(payload.message || "Invoice created.", "success");
            onSaved();
            onClose();
          } else {
            showAlert(payload?.message ?? "Couldn't create the invoice.", "error");
          }
        },
        onError: (err) => showAlert(`Create failed: ${err.message}`, "error"),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="spark-card w-full max-w-2xl my-8"
        style={{ background: "var(--spark-surface, #0f1310)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <h2 className="display text-xl font-bold">
            {existing ? `Edit invoice ${existing.number}` : "New invoice"}
          </h2>
          <button
            onClick={onClose}
            className="mono text-[11px]"
            style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Issue date">
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-xl text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Tax rate (%)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          <LineItemEditor
            lines={lines}
            currency={currency}
            taxRate={taxRate}
            onChange={setLines}
          />

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment terms, PO number, thank-you note — shown on the invoice."
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={ghostButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={inFlight}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={limeButton}
          >
            {inFlight
              ? "Saving…"
              : existing
                ? "Save changes"
                : "Create invoice"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Invoice row ───────────────────────────────────────────────────────
const InvoiceRow: React.FC<{
  invoice: Invoice;
  onEdit: () => void;
  onSetStatus: (status: string) => void;
  onDelete: () => void;
  busy: boolean;
}> = ({ invoice, onEdit, onSetStatus, onDelete, busy }) => {
  const chip = statusChip(invoice.status);
  const total = formatMoney(num(invoice.total), invoice.currency);
  const status = invoice.status;

  return (
    <div className="spark-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="font-bold text-base">{invoice.number}</p>
            <span className={chip.cls}>● {chip.label}</span>
          </div>
          <p
            className="mono text-[11px] uppercase mt-1"
            style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)" }}
          >
            {invoice.clientName}
          </p>
          <p
            className="mono text-[10px] mt-1.5"
            style={{ letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
          >
            Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
            {status === "paid" && invoice.paidAt
              ? ` · Paid ${formatDateTime(invoice.paidAt)}`
              : status === "sent" && invoice.sentAt
                ? ` · Sent ${formatDateTime(invoice.sentAt)}`
                : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="display text-2xl font-bold tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {total}
          </p>
          <p
            className="mono text-[10px] mt-0.5"
            style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}
          >
            {invoice.lineItems.length} ITEM
            {invoice.lineItems.length === 1 ? "" : "S"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-x-4 gap-y-2 mt-4 pt-4 flex-wrap"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <button
          type="button"
          onClick={onEdit}
          className="mono text-[11px]"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}
        >
          ✎ EDIT
        </button>

        {/* Status transitions: draft → sent → paid; void from anywhere but
            paid; un-void back to draft. */}
        {status === "draft" && (
          <StatusAction
            label="MARK SENT"
            icon="➤"
            color="var(--spark-sky)"
            busy={busy}
            onClick={() => onSetStatus("sent")}
          />
        )}
        {status === "sent" && (
          <StatusAction
            label="MARK PAID"
            icon="✓"
            color="var(--spark-lime)"
            busy={busy}
            onClick={() => onSetStatus("paid")}
          />
        )}
        {(status === "draft" || status === "sent") && (
          <StatusAction
            label="VOID"
            icon="∅"
            color="var(--spark-orange)"
            busy={busy}
            onClick={() => onSetStatus("void")}
          />
        )}
        {status === "void" && (
          <StatusAction
            label="REOPEN AS DRAFT"
            icon="↺"
            color="rgba(255,255,255,0.6)"
            busy={busy}
            onClick={() => onSetStatus("draft")}
          />
        )}

        <ShareLink token={invoice.shareToken} />

        <a
          href={invoicePdfUrl(invoice.shareToken)}
          target="_blank"
          rel="noreferrer"
          className="mono text-[11px]"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}
        >
          ⬇ PDF
        </a>

        <button
          type="button"
          onClick={onDelete}
          className="mono text-[11px] ml-auto"
          style={{ letterSpacing: "0.12em", color: "var(--spark-orange)" }}
        >
          🗑 DELETE
        </button>
      </div>
    </div>
  );
};

const StatusAction: React.FC<{
  label: string;
  icon: string;
  color: string;
  busy: boolean;
  onClick: () => void;
}> = ({ label, icon, color, busy, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className="mono text-[11px] disabled:opacity-40"
    style={{ letterSpacing: "0.12em", color }}
  >
    {busy ? "…" : `${icon} ${label}`}
  </button>
);

// ─── Invoice list (suspends on the invoices query) ─────────────────────
const InvoiceList: React.FC<{
  tenantId: string | null;
  status: StatusFilter;
  refreshKey: number;
  onEdit: (inv: Invoice) => void;
  onChanged: () => void;
  onMeta: (m: { total: number; outstanding: string }) => void;
}> = ({ tenantId, status, refreshKey, onEdit, onChanged, onMeta }) => {
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<InvoicesQueryType>(
    InvoicesQuery,
    { filters: { tenantId, status: status === "all" ? null : status } },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const invoices = useMemo(() => data?.invoices ?? [], [data]);

  const [statusCommit, settingStatus] =
    useMutation<SetInvoiceStatusMutationType>(SetInvoiceStatusMutation);
  const [deleteCommit] = useMutation<DeleteInvoiceMutationType>(
    DeleteInvoiceMutation,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Publish the count + outstanding (sent + unpaid, in the dominant
  // currency) up to the header. Outstanding ignores draft/void/paid.
  useEffect(() => {
    const currency = invoices[0]?.currency ?? "USD";
    const outstanding = invoices
      .filter((i) => i.status === "sent")
      .reduce((sum, i) => sum + num(i.total), 0);
    onMeta({
      total: invoices.length,
      outstanding: formatMoney(outstanding, currency),
    });
  }, [invoices, onMeta]);

  const setStatus = (invoice: Invoice, next: string) => {
    if (busyId) return;
    setBusyId(invoice.id);
    statusCommit({
      variables: { input: { id: invoice.id, status: next } },
      onCompleted: (res) => {
        setBusyId(null);
        const payload = res.setInvoiceStatus;
        if (payload?.success) {
          showAlert(payload.message || "Invoice updated.", "success");
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't update the invoice.", "error");
        }
      },
      onError: (err) => {
        setBusyId(null);
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  const confirmDelete = (invoice: Invoice) => {
    if (deletingId) return;
    setDeletingId(invoice.id);
    deleteCommit({
      variables: { input: { id: invoice.id } },
      onCompleted: (res) => {
        setDeletingId(null);
        const payload = res.deleteInvoice;
        if (payload?.success) {
          showAlert(payload.message || "Invoice deleted.", "success");
          setPendingDelete(null);
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't delete the invoice.", "error");
        }
      },
      onError: (err) => {
        setDeletingId(null);
        showAlert(`Delete failed: ${err.message}`, "error");
      },
    });
  };

  if (invoices.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <p className="text-sm">
          {status === "all"
            ? "No invoices yet."
            : `No ${status} invoices.`}
        </p>
        {status === "all" && (
          <p className="text-xs mt-1">
            Create one to bill a client for a campaign or activation.
          </p>
        )}
      </div>
    );
  }

  const busy = settingStatus;

  return (
    <>
      <div className="space-y-3">
        {invoices.map((inv) => (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            busy={busy && busyId === inv.id}
            onEdit={() => onEdit(inv)}
            onSetStatus={(next) => setStatus(inv, next)}
            onDelete={() => setPendingDelete(inv)}
          />
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete invoice?"
          tone="danger"
          confirmLabel="Delete invoice"
          busy={deletingId === pendingDelete.id}
          body={
            <>
              <span
                className="font-semibold"
                style={{ color: "var(--spark-text)" }}
              >
                {pendingDelete.number}
              </span>{" "}
              for {pendingDelete.clientName} will be removed. This can't be
              undone.
            </>
          }
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => {
            if (deletingId) return;
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
};

// Strip a leading "$" / "%" / commas for editing a numeric string in a
// form input (the server echoes amounts/rates as formatted strings).
function stripPct(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().replace(/[$%,]/g, "");
}

export default function SparkBilling() {
  const { tenantId } = useAuthStore();
  // Bumped to refetch the list after a create/edit/status/delete.
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const [meta, setMeta] = useState<{ total: number; outstanding: string }>({
    total: 0,
    outstanding: "",
  });

  const onMeta = useCallback(
    (m: { total: number; outstanding: string }) => setMeta(m),
    [],
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setModalOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
            >
              BILLING · {meta.total} INVOICE{meta.total === 1 ? "" : "S"}
              {meta.outstanding ? ` · ${meta.outstanding} OUTSTANDING` : ""}
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Invoices.
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Bill clients for campaigns &amp; activations. Build an invoice
              with line items, send a share link, and track it through to
              paid. Vendor payouts to BAs live in{" "}
              <a href="/payments" style={{ color: "var(--spark-sky)" }}>
                Payments
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={limeButton}
          >
            + New invoice
          </button>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => {
            const on = status === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: on ? "var(--spark-lime)" : "transparent",
                  color: on ? "#0a0d09" : "var(--spark-text)",
                  border: `1px solid ${
                    on ? "var(--spark-lime)" : "var(--spark-border)"
                  }`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading invoices…
            </div>
          }
        >
          <InvoiceList
            key={status}
            tenantId={tenantId}
            status={status}
            refreshKey={refreshKey}
            onEdit={openEdit}
            onChanged={refresh}
            onMeta={onMeta}
          />
        </Suspense>
      </div>

      {modalOpen && (
        <InvoiceFormModal
          tenantId={tenantId}
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={refresh}
        />
      )}
    </Layout>
  );
}
