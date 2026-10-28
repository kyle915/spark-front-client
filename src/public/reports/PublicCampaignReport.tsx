import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import CampaignReportView from "@/reports/CampaignReportView";
import type { CampaignReportData } from "@/reports/CampaignReportView";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";

/**
 * Public, no-login campaign report — /report/:token.
 *
 * The signed :token in the URL is the only auth (no login, no tenant
 * guard — registered alongside /c/:slug and /receipt-upload/:token). It
 * fetches the report from the no-auth REST surface the backend serves:
 *
 *   GET {API_ORIGIN}/api/public/report/<token>
 *     -> { report: { ...CampaignReport minus shareToken } }
 *     -> 400 (bad token) / 410 (expired) with { error, message }
 *
 *   {API_ORIGIN}/api/public/report/<token>/pdf  (application/pdf)
 *
 * Renders the SAME <CampaignReportView> the admin view uses, wrapped in
 * standalone spark-v2 dark chrome (the admin shell normally applies the
 * theme; a public page must set it itself). API_ORIGIN is derived from
 * VITE_GRAPHQL_ENDPOINT, exactly like CampaignUpload.tsx.
 */

type ApiError = { error: string; message: string };

// Same payload as CampaignReportData, but the public REST shape carries no
// shareToken (the token is already in the URL).
type ReportPayload = CampaignReportData;

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
  if (status === 410 || code === "expired" || code === "token_expired") {
    return "This report link has expired. Ask your Ignite contact for a fresh link.";
  }
  if (status === 400 || code === "invalid" || code === "bad_token" || code === "not_found") {
    return "This report link isn't valid. Double-check the link or ask for a new one.";
  }
  return serverMessage || "We couldn't load this report. Please try again.";
}

// Standalone dark chrome for the public surface — mirrors the public form
// layout's near-black background + Spark mark, but self-contained.
const Shell: React.FC<{ children: React.ReactNode; actions?: React.ReactNode }> = ({
  children,
  actions,
}) => (
  <RecapDocument page actions={actions}>
    <main className="recap-doc-body">{children}</main>
  </RecapDocument>
);

const PublicCampaignReport: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);

  const endpoint = token
    ? `${origin}/api/public/report/${encodeURIComponent(token)}`
    : "";
  const pdfUrl = token
    ? `${origin}/api/public/report/${encodeURIComponent(token)}/pdf`
    : "";

  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // Public pages own their theme: force spark-v2 so the brand tokens
  // resolve even when the visitor has never set a theme (no admin shell to
  // apply it). Restore whatever was there on unmount.
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
          setReport(null);
        } else {
          const payload = (json as { report?: ReportPayload }).report ?? null;
          if (payload) {
            setReport(payload);
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
          style={{ color: "var(--recap-muted, #5c6154)" }}
        >
          Loading report…
        </div>
      </Shell>
    );
  }

  if (loadErr || !report) {
    return (
      <PublicDeadLink
        eyebrow="Campaign report"
        title={
          loadErr?.error === "expired" || loadErr?.error === "token_expired"
            ? "This report link has expired."
            : "We couldn't open this report."
        }
        message={loadErr?.message ?? errorCopy(400, "invalid")}
      />
    );
  }

  return (
    <Shell
      actions={
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime, #f2f3ee)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(242,243,238,0.35)",
            textDecoration: "none",
          }}
          title="Download this report as a PDF"
        >
          ⬇ Download PDF
        </a>
      }
    >
      <CampaignReportView report={report} />
    </Shell>
  );
};

export default PublicCampaignReport;
