import { Suspense, useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import Layout from "@/layout/Layout";
import environment from "@/api/relay/environment";
import { useAlertStore } from "@/store/alertStore";
import { CampaignReportQuery } from "@/api/queries/CampaignReportQuery";
import type { CampaignReportQuery as CampaignReportQueryType } from "@api/queries/__generated__/CampaignReportQuery.graphql";
import { CampaignReportAiAnswerQuery } from "@/api/queries/CampaignReportAiAnswerQuery";
import type { CampaignReportAiAnswerQuery as CampaignReportAiAnswerQueryType } from "@api/queries/__generated__/CampaignReportAiAnswerQuery.graphql";
import CampaignReportView from "./CampaignReportView";
import { RecapDocument } from "@/recap/RecapDocument";
import type { CampaignReportData } from "./CampaignReportView";
import AiMarkdown from "@/components/ai/AiMarkdown";
import AiChartView, { type AiChart } from "@/components/ai/AiChartView";
import { campaignReportPublicUrl } from "@/utils/publicHosts";

/**
 * Authenticated admin campaign-report view — /report-view/:requestId.
 *
 * Runs the `campaignReport` query for a Request and renders the shared
 * <CampaignReportView>. Adds two report-level actions:
 *   • Copy public link → client. /report/<shareToken> (never window.origin),
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
  color: "var(--spark-on-accent)",
};

type AiAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: AiChart | null;
};

/**
 * On-demand campaign Q&A card (admin report view only).
 *
 * Sibling of <AiSummaryCard>: a text input + "Ask" button that fires
 * `campaignReportAiAnswer(requestId, question)` imperatively on submit —
 * never on mount — so the model cost is only paid when an admin actually
 * asks something. The answer is grounded strictly in this campaign's
 * aggregated data. While in flight it shows a spinner ("Thinking…"); on
 * success it renders the answer as markdown (headings, bold, bullet lists)
 * via <AiMarkdown>; a failure (`ok: false`) shows the server's `reason`
 * muted. The input stays editable
 * so the user can ask again — the latest answer replaces the previous one.
 * The button is disabled while empty or a request is in flight.
 */
const AiAnswerCard: React.FC<{ requestId: string }> = ({ requestId }) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswerResult | null>(null);

  const trimmed = question.trim();
  const canAsk = trimmed.length > 0 && !loading;

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    try {
      const data = await fetchQuery<CampaignReportAiAnswerQueryType>(
        environment,
        CampaignReportAiAnswerQuery,
        { requestId, question: q },
        { fetchPolicy: "network-only" },
      ).toPromise();

      const res = data?.campaignReportAiAnswer;
      if (!res) {
        setResult({
          ok: false,
          answer: "",
          reason: "No response from the answer service.",
        });
        return;
      }
      setResult({
        ok: res.ok,
        answer: res.answer,
        reason: res.reason,
        chart: res.chart,
      });
    } catch {
      setResult({
        ok: false,
        answer: "",
        reason: "Couldn't reach the answer service — try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [requestId, question]);

  return (
    <div className="spark-card p-5">
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--spark-text-meta)",
          }}
        >
          Ask about this campaign
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
          Ask a question about this campaign&apos;s data and get an answer on
          demand.
        </p>
      </div>

      <form
        className="mt-4 flex items-center gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (canAsk) void ask();
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
          placeholder="Ask about this campaign's results…"
          className="flex-1 min-w-[220px] px-4 py-2 rounded-xl text-sm transition disabled:opacity-60"
          style={{
            background: "rgba(var(--spark-ink-rgb),0.04)",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        />
        <button
          type="submit"
          disabled={!canAsk}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          style={limeBtn}
          title="Ask a question about this campaign's data"
        >
          {loading && (
            <span
              aria-hidden
              className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
              style={{
                border: "2px solid rgba(var(--spark-bg-rgb),0.35)",
                borderTopColor: "#0a0d09",
              }}
            />
          )}
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {result && !loading && (
        <div className="mt-4">
          {result.ok ? (
            <>
              <AiMarkdown>{result.answer}</AiMarkdown>
              {result.chart ? <AiChartView chart={result.chart} /> : null}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
              {result.reason || "Couldn't answer that from this campaign's data."}
            </p>
          )}
        </div>
      )}
    </div>
  );
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
    ? campaignReportPublicUrl(report.shareToken)
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
        style={{ color: "var(--spark-text-secondary)" }}
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
          style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
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
            {copied ? "✓ Copied public link" : "Copy public link"}
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

      {/* On-demand campaign Q&A — admin view only */}
      <AiAnswerCard requestId={report.requestId} />

      <RecapDocument>
        <CampaignReportView report={viewData} />
      </RecapDocument>
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
                style={{ color: "var(--spark-text-meta)" }}
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
            style={{ color: "var(--spark-text-meta)" }}
          >
            Missing request id.
          </div>
        )}
      </div>
    </Layout>
  );
}
