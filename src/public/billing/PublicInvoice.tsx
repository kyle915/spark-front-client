import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";

/**
 * Public, no-login invoice — /invoice/:token.
 *
 * Renders on Spark's light editorial paper (`RecapDocument page`) with crisp
 * tabular-nums line items, Print/Save PDF, and direct backend PDF download.
 */

type PublicLineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

type PublicInvoiceData = {
  number: string;
  status: string;
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  lineItems: PublicLineItem[];
};

type ApiError = { error: string; message: string };

const INK = "var(--recap-text, #14160f)";
const MUTED = "var(--recap-muted, #5c6154)";
const BORDER = "var(--recap-border, #e2e4d8)";

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

function errorCopy(status: number, code: string, serverMessage?: string): string {
  if (status === 410 || code === "expired" || code === "revoked" || code === "void") {
    return "This invoice link is no longer active. Ask your Ignite contact for an up-to-date copy.";
  }
  if (
    status === 400 ||
    code === "invalid" ||
    code === "bad_token" ||
    code === "not_found"
  ) {
    return "This invoice link isn't valid. Double-check the link or ask for a new one.";
  }
  return serverMessage || "We couldn't load this invoice. Please try again.";
}

const num = (raw: string | null | undefined): number => {
  if (raw == null) return 0;
  const n = Number(String(raw).trim().replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (raw: string | null | undefined, currency: string): string => {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(num(raw));
  } catch {
    return `${code} ${num(raw).toFixed(2)}`;
  }
};

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

const statusBadgeStyle = (status: string): { label: string; bg: string; color: string; border: string } => {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        bg: "rgba(63, 92, 18, 0.11)",
        color: "#2b4c08",
        border: "rgba(63, 92, 18, 0.28)",
      };
    case "sent":
      return {
        label: "Sent",
        bg: "rgba(12, 88, 136, 0.1)",
        color: "#0c5888",
        border: "rgba(12, 88, 136, 0.25)",
      };
    case "void":
      return {
        label: "Void",
        bg: "rgba(210, 72, 27, 0.1)",
        color: "#a8340f",
        border: "rgba(210, 72, 27, 0.28)",
      };
    case "draft":
      return {
        label: "Draft",
        bg: "#f4f5ef",
        color: "#5c6154",
        border: "#e2e4d8",
      };
    default:
      return {
        label: (status || "Open").charAt(0).toUpperCase() + (status || "open").slice(1).toLowerCase(),
        bg: "#f4f5ef",
        color: "#5c6154",
        border: "#e2e4d8",
      };
  }
};

const TotalRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between gap-6">
    <span
      className={strong ? "text-base font-bold" : "text-sm"}
      style={{ color: strong ? INK : MUTED }}
    >
      {label}
    </span>
    <span
      className={`tab-num ${strong ? "display text-xl font-bold" : "text-sm font-medium"}`}
      style={{ color: INK, letterSpacing: strong ? "-0.02em" : undefined }}
    >
      {value}
    </span>
  </div>
);

const PublicInvoice: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);

  const endpoint = token
    ? `${origin}/api/public/invoice/${encodeURIComponent(token)}`
    : "";
  const pdfUrl = token
    ? `${origin}/api/public/invoice/${encodeURIComponent(token)}/pdf`
    : "";

  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevMode = root.getAttribute("data-spark-mode");
    root.setAttribute("data-theme", "spark-v2");
    root.setAttribute("data-spark-mode", "light");
    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      if (prevMode) root.setAttribute("data-spark-mode", prevMode);
      else root.removeAttribute("data-spark-mode");
    };
  }, []);

  useEffect(() => {
    if (!endpoint) {
      setLoading(false);
      setLoadErr({ error: "invalid", message: errorCopy(400, "invalid") });
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const code = (json as ApiError).error || "invalid";
          setLoadErr({
            error: code,
            message: errorCopy(res.status, code, (json as ApiError).message),
          });
          setInvoice(null);
        } else {
          const payload =
            (json as { invoice?: PublicInvoiceData }).invoice ?? null;
          if (payload) {
            setInvoice(payload);
            setLoadErr(null);
          } else {
            setLoadErr({ error: "invalid", message: errorCopy(400, "invalid") });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadErr({
          error: "network",
          message:
            "We couldn't reach the server. Check your connection and try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (loading) {
    return (
      <RecapDocument page status="Invoice">
        <main className="recap-doc-body">
          <p className="text-sm py-8 text-center" style={{ color: MUTED }}>
            Loading invoice…
          </p>
        </main>
      </RecapDocument>
    );
  }

  if (loadErr || !invoice) {
    return (
      <PublicDeadLink
        eyebrow="Invoice"
        title={
          loadErr?.error === "expired" ||
          loadErr?.error === "revoked" ||
          loadErr?.error === "void"
            ? "This invoice link has expired."
            : "We couldn't open this invoice."
        }
        message={loadErr?.message ?? errorCopy(400, "invalid")}
      />
    );
  }

  const badge = statusBadgeStyle(invoice.status);
  const currency = invoice.currency || "USD";

  return (
    <RecapDocument
      page
      brandName={invoice.clientName}
      status={badge.label}
      actions={
        <div className="no-print print:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-85 cursor-pointer"
            style={{
              background: "#ffffff",
              color: INK,
              border: `1px solid ${BORDER}`,
            }}
          >
            Print
          </button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={{
              background: INK,
              color: "#ffffff",
              textDecoration: "none",
            }}
            title="Download this invoice as a PDF"
          >
            ↓ Download PDF
          </a>
        </div>
      }
    >
      <main className="recap-doc-body space-y-6">
        <div
          className="rounded-xl p-6 sm:p-8"
          style={{
            background: "#ffffff",
            border: `1px solid ${BORDER}`,
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p
                className="mono text-[10px] font-semibold"
                style={{ letterSpacing: "0.18em", color: MUTED }}
              >
                INVOICE
              </p>
              <h1
                className="display text-3xl font-bold mt-1 tab-num"
                style={{ letterSpacing: "-0.03em", color: INK }}
              >
                {invoice.number}
              </h1>
              <p className="text-sm mt-2" style={{ color: MUTED }}>
                Billed to{" "}
                <span className="font-semibold" style={{ color: INK }}>
                  {invoice.clientName}
                </span>
              </p>
            </div>
            <div className="text-right">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
              <p className="text-xs mt-3 tab-num" style={{ color: MUTED }}>
                Issued <strong style={{ color: INK }}>{formatDate(invoice.issueDate)}</strong>
              </p>
              <p className="text-xs mt-1 tab-num" style={{ color: MUTED }}>
                Due <strong style={{ color: INK }}>{formatDate(invoice.dueDate)}</strong>
              </p>
            </div>
          </div>

          {/* Line-item table */}
          <div
            className="mt-7 overflow-x-auto rounded-xl"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr
                  className="text-xs font-semibold"
                  style={{
                    color: MUTED,
                    background: "#f8f8f4",
                  }}
                >
                  <th className="text-left font-semibold px-4 py-2.5">Description</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">
                    Qty
                  </th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">
                    Unit price
                  </th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li, idx) => (
                  <tr
                    key={idx}
                    style={{ borderTop: `1px solid ${BORDER}` }}
                  >
                    <td className="px-4 py-3" style={{ color: INK }}>
                      {li.description}
                    </td>
                    <td
                      className="px-4 py-3 text-right tab-num whitespace-nowrap"
                      style={{ color: MUTED }}
                    >
                      {li.quantity}
                    </td>
                    <td
                      className="px-4 py-3 text-right tab-num whitespace-nowrap"
                      style={{ color: MUTED }}
                    >
                      {formatMoney(li.unitPrice, currency)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tab-num font-semibold whitespace-nowrap"
                      style={{ color: INK }}
                    >
                      {formatMoney(li.amount, currency)}
                    </td>
                  </tr>
                ))}
                {invoice.lineItems.length === 0 && (
                  <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm"
                      style={{ color: MUTED }}
                    >
                      No line items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-5 flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <TotalRow
                label="Subtotal"
                value={formatMoney(invoice.subtotal, currency)}
              />
              <TotalRow
                label={`Tax (${stripPct(invoice.taxRate)}%)`}
                value={formatMoney(invoice.taxAmount, currency)}
              />
              <div
                className="pt-2.5"
                style={{ borderTop: `1px solid ${BORDER}` }}
              >
                <TotalRow
                  label="Total"
                  value={formatMoney(invoice.total, currency)}
                  strong
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div
              className="mt-7 pt-5"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              <p
                className="mono text-[10px] font-semibold mb-1.5"
                style={{ letterSpacing: "0.16em", color: MUTED }}
              >
                NOTES
              </p>
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: INK }}
              >
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        <footer
          className="text-center mono text-[10px] pb-4"
          style={{ letterSpacing: "0.16em", color: MUTED }}
        >
          SPARK BY IGNITE · INVOICE
        </footer>
      </main>
    </RecapDocument>
  );
};

function stripPct(raw: string | null | undefined): string {
  if (raw == null) return "0";
  const v = String(raw).trim().replace(/[$%,]/g, "");
  return v || "0";
}

export default PublicInvoice;
