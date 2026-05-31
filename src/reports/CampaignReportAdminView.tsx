import { Suspense, useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import { CampaignReportQuery } from "@/api/queries/CampaignReportQuery";
import type { CampaignReportQuery as CampaignReportQueryType } from "@api/queries/__generated__/CampaignReportQuery.graphql";
import CampaignReportView from "./CampaignReportView";
import type { CampaignReportData } from "./CampaignReportView";

/**
 * Authenticated admin campaign-report view — /report-view/:requestId.
 *
 * Runs the `campaignReport` query for a Request and renders the shared
 * <CampaignReportView>. Adds two report-level actions:
 *   • Copy public link → `${origin}/report/<shareToken>` (the no-login
 *     shareable page), and
 *   • Download PDF → opens `${API_ORIGIN}/api/public/report/<shareToken>/pdf`.
 *
 * Lives INSIDE the normal authed + tenant-guarded app (registered as a
 * non-public route). The public twin at /report/:token renders the same
 * view from the REST endpoint instead.
 */

// Derive the REST API origin from the GraphQL endpoint env var (scheme +
// host), exactly like CampaignUpload.tsx / ReceiptUpload.tsx — so the PDF
// link and the public REST surface share one base without a second env var.
function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "#0a0d09",
  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
};

const ReportLoaded: React.FC<{ requestId: string }> = ({ requestId }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [copied, setCopied] = useState(false);

  const data = useLazyLoadQuery<CampaignReportQueryType>(
    CampaignReportQuery,
    { requestId },
    { fetchPolicy: "store-and-network" },
  );

  const report = data?.campaignReport ?? null;

  // Map the (read-only) Relay result into the plain shape the shared view
  // renders. Spreads drop Relay's readonly markers; fields line up 1:1.
  const viewData: CampaignReportData | null = useMemo(() => {
    if (!report) return null;
    return {
      requestId: report.requestId,
      brandName: report.brandName,
      title: report.title,
      dateRange: report.dateRange,
      generatedAt: report.generatedAt,
      kpis: { ...report.kpis },
      events: report.events.map((e) => ({ ...e })),
      photos: report.photos.map((p) => ({ ...p })),
      ambassadors: report.ambassadors.map((b) => ({ ...b })),
      highlights: report.highlights.map((h) => ({ ...h })),
    };
  }, [report]);

  const shareUrl = report
    ? `${window.location.origin}/report/${report.shareToken}`
    : "";
  const pdfUrl = report
    ? `${apiOrigin()}/api/public/report/${report.shareToken}/pdf`
    : "";

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("Couldn't reach the clipboard — copy the link manually.", "warning");
    }
  }, [shareUrl, showAlert]);

  if (!report || !viewData) {
    return (
      <div
        className="spark-card p-10 text-center"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        <p className="display text-2xl font-bold">No report available.</p>
        <p className="text-sm mt-2">
          This request doesn&apos;t have a campaign report yet. Reports are
          generated once a request has activations and recaps.
        </p>
        <button
          type="button"
          onClick={() => navigate("/requests/list")}
          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={ghostBtn}
        >
          ← Back to tracker
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Report-level actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mono text-[11px]"
          style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}
        >
          ← BACK
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={copyLink}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={
              copied
                ? {
                    background: "rgba(95,184,239,0.18)",
                    color: "var(--spark-sky)",
                    border: "1px solid rgba(95,184,239,0.5)",
                  }
                : ghostBtn
            }
            title="Copy the no-login public report link"
          >
            {copied ? "✓ Copied public link" : "🔗 Copy public link"}
          </button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={limeBtn}
            title="Download the report as a PDF"
          >
            ⬇ Download PDF
          </a>
        </div>
      </div>

      <CampaignReportView report={viewData} />
    </div>
  );
};

export default function CampaignReportAdminView() {
  const { requestId } = useParams<{ requestId: string }>();

  return (
    <Layout>
      <div className="max-w-5xl">
        {requestId ? (
          <Suspense
            fallback={
              <div
                className="spark-card p-10 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading report…
              </div>
            }
          >
            <ReportLoaded requestId={requestId} />
          </Suspense>
        ) : (
          <div
            className="spark-card p-10 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Missing request id.
          </div>
        )}
      </div>
    </Layout>
  );
}
