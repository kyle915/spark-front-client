import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";

/**
 * Public, no-login invoice — /invoice/:token.
 *
 * The :token in the URL is the only handle (no login, no tenant guard —
 * registered alongside /c/:slug and /report/:token). It fetches the
 * invoice from the no-auth REST surface the backend serves:
 *
 *   GET {API_ORIGIN}/api/public/invoice/<token>
 *     -> { invoice: { number, status, clientName, issueDate, dueDate,
 *          currency, notes, subtotal, taxRate, taxAmount, total,
 *          lineItems:[{ description, quantity, unitPrice, amount }] } }
 *     -> 400 (bad token) / 410 (revoked/expired)
 *
 *   {API_ORIGIN}/api/public/invoice/<token>/pdf  (application/pdf)
 *
 * Renders a clean branded invoice wrapped in standalone spark-v2 dark
 * chrome (a public page must set the theme itself — there's no admin shell
 * to apply it). API_ORIGIN is derived from VITE_GRAPHQL_ENDPOINT, exactly
 * like CampaignUpload.tsx / PublicCampaignReport.tsx.
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

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

// Friendly copy for the documented backend error codes; falls back to the
// server message (or a generic line) for anything unmapped.
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

// Parse a money-ish string to a finite number, else 0.
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
      return { cls: "chip chip-gold", label: (status || "").toUpperCase() };
  }
};

// Standalone dark chrome for the public surface — mirrors PublicCampaignReport.
const Shell: React.FC<{
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ children, actions }) => (
  <div
    className="min-h-screen"
    style={{
      background: "var(--spark-bg, #0a0d09)",
      color: "var(--spark-text, #f2f3ee)",
    }}
  >
    <header
      className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
      style={{
        background: "rgba(10,13,9,0.85)",
        borderBottom: "1px solid var(--spark-border, #1f2418)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p
        className="display"
        style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        Spark <span style={{ color: "var(--spark-lime, #c5f546)" }}>by Ignite</span>
      </p>
      {actions}
    </header>
    <main className="max-w-3xl mx-auto px-5 py-8 sm:py-10">{children}</main>
    <footer
      className="max-w-3xl mx-auto px-5 pb-10 mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.35)",
      }}
    >
      SPARK BY IGNITE · INVOICE
    </footer>
  </div>
);

const TotalRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between gap-6">
    <span
      className={strong ? "text-base font-bold" : "text-sm"}
      style={{ color: strong ? "var(--spark-text)" : "rgba(255,255,255,0.6)" }}
    >
      {label}
    </span>
    <span
      className={`mono tabular-nums ${strong ? "text-lg font-bold" : "text-sm"}`}
      style={{ color: strong ? "var(--spark-lime)" : "rgba(255,255,255,0.85)" }}
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

  // Public pages own their theme: force spark-v2 so the brand tokens
  // resolve even when the visitor has never set a theme. Restore on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "spark-v2");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
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
      <Shell>
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Loading invoice…
        </div>
      </Shell>
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

  const chip = statusChip(invoice.status);
  const currency = invoice.currency || "USD";

  return (
    <Shell
      actions={
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime, #c5f546)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.35)",
            textDecoration: "none",
          }}
          title="Download this invoice as a PDF"
        >
          ⬇ Download PDF
        </a>
      }
    >
      <div className="spark-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
            >
              INVOICE
            </p>
            <h1
              className="display text-3xl font-bold mt-1"
              style={{ letterSpacing: "-0.03em" }}
            >
              {invoice.number}
            </h1>
            <p
              className="text-sm mt-2"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Billed to{" "}
              <span className="font-semibold" style={{ color: "var(--spark-text)" }}>
                {invoice.clientName}
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className={chip.cls}>● {chip.label}</span>
            <p
              className="mono text-[11px] mt-3"
              style={{ letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)" }}
            >
              Issued {formatDate(invoice.issueDate)}
            </p>
            <p
              className="mono text-[11px] mt-1"
              style={{ letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)" }}
            >
              Due {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        {/* Line-item table */}
        <div
          className="mt-7 overflow-x-auto rounded-xl"
          style={{ border: "1px solid var(--spark-border)" }}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="mono text-[10px] uppercase"
                style={{
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <th className="text-left font-normal px-4 py-2.5">Description</th>
                <th className="text-right font-normal px-4 py-2.5 whitespace-nowrap">
                  Qty
                </th>
                <th className="text-right font-normal px-4 py-2.5 whitespace-nowrap">
                  Unit price
                </th>
                <th className="text-right font-normal px-4 py-2.5 whitespace-nowrap">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li, idx) => (
                <tr
                  key={idx}
                  style={{ borderTop: "1px solid var(--spark-border)" }}
                >
                  <td className="px-4 py-3" style={{ color: "var(--spark-text)" }}>
                    {li.description}
                  </td>
                  <td
                    className="px-4 py-3 text-right mono tabular-nums whitespace-nowrap"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    {li.quantity}
                  </td>
                  <td
                    className="px-4 py-3 text-right mono tabular-nums whitespace-nowrap"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    {formatMoney(li.unitPrice, currency)}
                  </td>
                  <td
                    className="px-4 py-3 text-right mono tabular-nums whitespace-nowrap"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {formatMoney(li.amount, currency)}
                  </td>
                </tr>
              ))}
              {invoice.lineItems.length === 0 && (
                <tr style={{ borderTop: "1px solid var(--spark-border)" }}>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "rgba(255,255,255,0.45)" }}
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
              className="pt-2"
              style={{ borderTop: "1px solid var(--spark-border)" }}
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
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <p className="label-mini mb-1.5">NOTES</p>
            <p
              className="text-sm whitespace-pre-wrap leading-relaxed"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {invoice.notes}
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
};

// Strip "%" / "$" / commas so a server-formatted rate string renders as a
// bare number inside the "Tax (N%)" label.
function stripPct(raw: string | null | undefined): string {
  if (raw == null) return "0";
  const v = String(raw).trim().replace(/[$%,]/g, "");
  return v || "0";
}

export default PublicInvoice;
