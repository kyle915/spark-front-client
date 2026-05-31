import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { TenantAiAnswerQuery } from "@/api/queries/TenantAiAnswerQuery";
import type { TenantAiAnswerQuery as TenantAiAnswerQueryType } from "@api/queries/__generated__/TenantAiAnswerQuery.graphql";

/**
 * Reusable "Ask AI" surface — a prominent button that opens a pop-up modal
 * for asking a freeform question about ONE client's whole program (all of
 * that tenant's aggregated events, recaps, and KPIs).
 *
 * Mounted on both dashboards:
 *   • the admin home/dashboard (DashboardEvent), scoped to the active tenant
 *     selected in the workspace switcher, and
 *   • the client dashboard (SparkClientDashboard), scoped to the client's own
 *     tenant.
 *
 * Both resolve the active tenant id the same way every other per-tenant
 * surface does — `useAuthStore().tenantId` — and hand it down as `tenantId`.
 *
 * The Q&A logic mirrors <AiAnswerCard> in CampaignReportAdminView exactly:
 * the query is fired imperatively via `fetchQuery(environment, …, {
 * fetchPolicy: "network-only" }).toPromise()` on submit — never on mount — so
 * the model cost is only paid when someone actually asks something. While in
 * flight it shows "Thinking…"; on success it renders `answer` (paragraph
 * breaks preserved); a failure (`ok: false`) shows the server's `reason`
 * muted. The input stays editable so the user can ask again — the latest
 * answer replaces the previous one. The Ask button is disabled while the
 * input is empty or a request is in flight.
 */

type AiAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
};

const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "#0a0d09",
  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
};

const AskAiModal: React.FC<{
  tenantId: string;
  tenantName?: string;
  onClose: () => void;
}> = ({ tenantId, tenantName, onClose }) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswerResult | null>(null);

  const trimmed = question.trim();
  const canAsk = trimmed.length > 0 && !loading && Boolean(tenantId);

  // Close on Escape so the pop-up behaves like the workspace's other modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || !tenantId) return;
    setLoading(true);
    try {
      const data = await fetchQuery<TenantAiAnswerQueryType>(
        environment,
        TenantAiAnswerQuery,
        { tenantId, question: q },
        { fetchPolicy: "network-only" },
      ).toPromise();

      const res = data?.tenantAiAnswer;
      if (!res) {
        setResult({
          ok: false,
          answer: "",
          reason: "No response from the answer service.",
        });
        return;
      }
      setResult({ ok: res.ok, answer: res.answer, reason: res.reason });
    } catch {
      setResult({
        ok: false,
        answer: "",
        reason: "Couldn't reach the answer service — try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, question]);

  // Preserve paragraph breaks: split on blank lines into paragraphs and
  // keep single newlines inside a paragraph as soft line breaks.
  const paragraphs = useMemo(() => {
    if (!result?.ok || !result.answer) return [];
    return result.answer
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }, [result]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{
        background: "rgba(10,13,9,0.55)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg spark-card p-6"
        style={{ borderRadius: 20 }}
        role="dialog"
        aria-modal="true"
        aria-label="Ask AI about this client"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--spark-lime)",
              }}
            >
              Ask AI
            </p>
            <h2
              className="display text-2xl font-bold mt-1"
              style={{ letterSpacing: "-0.03em" }}
            >
              {tenantName ? `Ask about ${tenantName}.` : "Ask about this client."}
            </h2>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Answers draw on this client&apos;s whole program — every event,
              recap, and KPI we have.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.55)",
            }}
            title="Close"
          >
            CLOSE
          </button>
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
            autoFocus
            placeholder="Ask anything about this client's program…"
            className="flex-1 min-w-[220px] px-4 py-2 rounded-xl text-sm transition disabled:opacity-60"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          />
          <button
            type="submit"
            disabled={!canAsk}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={limeBtn}
            title="Ask a question about this client's program"
          >
            {loading && (
              <span
                aria-hidden
                className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
                style={{
                  border: "2px solid rgba(10,13,9,0.35)",
                  borderTopColor: "#0a0d09",
                }}
              />
            )}
            {loading ? "Thinking…" : "Ask"}
          </button>
        </form>

        {result && !loading && (
          <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
            {result.ok ? (
              <div
                className="space-y-3"
                style={{ color: "var(--spark-text)" }}
              >
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {result.reason ||
                  "Couldn't answer that from this client's data."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AskAiButton: React.FC<{
  tenantId: string | null | undefined;
  tenantName?: string;
  className?: string;
}> = ({ tenantId, tenantName, className }) => {
  const [open, setOpen] = useState(false);

  // No tenant in scope → nothing to ask about. Hide rather than render a
  // dead button.
  if (!tenantId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 ${
          className ?? ""
        }`}
        style={limeBtn}
        title="Ask AI a question about this client's program"
      >
        ✨ Ask AI
      </button>
      {open && (
        <AskAiModal
          tenantId={tenantId}
          tenantName={tenantName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default AskAiButton;
