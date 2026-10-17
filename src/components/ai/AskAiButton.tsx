import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { TenantAiAnswerQuery } from "@/api/queries/TenantAiAnswerQuery";
import type { TenantAiAnswerQuery as TenantAiAnswerQueryType } from "@api/queries/__generated__/TenantAiAnswerQuery.graphql";
import AiMarkdown from "./AiMarkdown";
import AiChartView, { type AiChart } from "./AiChartView";
import {
  ASK_AI_FOLLOWUPS,
  EVENT_ASK_AI_FOLLOWUPS,
  RECAP_ASK_AI_FOLLOWUPS,
  jumpOriginFromElement,
  thoughtLabel,
  thoughtSeconds,
  type AskAiScope,
  type JumpOrigin,
} from "@/motion/opsMotion";
import SparkOverlay from "@/shared/SparkOverlay";
import { askAiModalTitle } from "./askAiSubjectName";

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
 * flight it shows "Thinking…"; on success it renders `answer` as markdown
 * (headings, bold, bullet lists) via <AiMarkdown>; a failure (`ok: false`)
 * shows the server's `reason`
 * muted. The input stays editable so the user can ask again — the latest
 * answer replaces the previous one. The Ask button is disabled while the
 * input is empty or a request is in flight.
 */

type AiAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: AiChart | null;
};

const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "#0a0d09",
  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
};

type ScopeCopy = {
  kicker: string;
  title: string;
  blurb: string;
  placeholder: string;
  followups: readonly string[];
};

function scopeCopy(
  scope: AskAiScope,
  tenantName?: string,
  subjectLabel?: string,
): ScopeCopy {
  switch (scope) {
    case "tenant":
      return {
        kicker: "Ask AI",
        title: askAiModalTitle(tenantName),
        blurb:
          "Answers draw on this client's whole program — every event, recap, and KPI we have.",
        placeholder: "Ask anything about this client's program…",
        followups: ASK_AI_FOLLOWUPS,
      };
    case "recap":
      return {
        kicker: "Ask AI · this recap",
        title: subjectLabel ? `Ask about ${subjectLabel}.` : "Ask about this recap.",
        blurb:
          "Answers use only this recap's filed fields, notes, stored KPIs, and photo metadata.",
        placeholder: "Ask about this recap…",
        followups: RECAP_ASK_AI_FOLLOWUPS,
      };
    case "event":
      return {
        kicker: "Ask AI · this event",
        title: subjectLabel ? `Ask about ${subjectLabel}.` : "Ask about this event.",
        blurb:
          "Answers use only this event's filed recaps, notes, stored KPIs, and photo metadata.",
        placeholder: "Ask about this event…",
        followups: EVENT_ASK_AI_FOLLOWUPS,
      };
    default: {
      const _never: never = scope;
      return _never;
    }
  }
}

const AskAiModal: React.FC<{
  tenantId: string;
  tenantName?: string;
  scope: AskAiScope;
  recapId?: string | null;
  eventId?: string | null;
  subjectLabel?: string;
  origin?: JumpOrigin | null;
  onClose: () => void;
}> = ({
  tenantId,
  tenantName,
  scope,
  recapId,
  eventId,
  subjectLabel,
  origin = null,
  onClose,
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswerResult | null>(null);
  const [thoughtFor, setThoughtFor] = useState<number | null>(null);
  const startedAt = useRef(0);

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

  const ask = useCallback(async (raw?: string) => {
    const q = (raw ?? question).trim();
    if (!q || !tenantId) return;
    setQuestion(q);
    setLoading(true);
    setThoughtFor(null);
    startedAt.current = Date.now();
    try {
      const data = await fetchQuery<TenantAiAnswerQueryType>(
        environment,
        TenantAiAnswerQuery,
        {
          tenantId,
          question: q,
          recapId: scope === "recap" ? recapId ?? null : null,
          eventId: scope === "event" ? eventId ?? null : null,
        },
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
      setThoughtFor(thoughtSeconds(Date.now() - startedAt.current));
      setLoading(false);
    }
  }, [tenantId, question, scope, recapId, eventId]);

  const copy = scopeCopy(scope, tenantName, subjectLabel);

  return (
    <SparkOverlay
      onClose={onClose}
      origin={origin}
      size="lg"
      label={copy.title}
    >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="spark-overlay-kicker" style={{ color: "var(--spark-lime)" }}>
              {copy.kicker}
            </p>
            <h2 className="spark-overlay-title">{copy.title}</h2>
            <p className="spark-overlay-copy">{copy.blurb}</p>
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
            placeholder={copy.placeholder}
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
            Ask
          </button>
        </form>

        {loading ? (
          <p className="spark-ops-thinking mt-4">Thinking…</p>
        ) : thoughtFor != null ? (
          <p className="spark-ops-thought mt-4">{thoughtLabel(thoughtFor)}</p>
        ) : null}

        {result && !loading && (
          <div className="mt-3 max-h-[55vh] overflow-y-auto pr-1">
            {result.ok ? (
              <>
                <AiMarkdown>{result.answer}</AiMarkdown>
                {result.chart ? <AiChartView chart={result.chart} /> : null}
                <div className="spark-ops-followups">
                  {copy.followups.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="spark-ops-chip"
                      onClick={() => void ask(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </>
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
    </SparkOverlay>
  );
};

const AskAiButton: React.FC<{
  tenantId: string | null | undefined;
  tenantName?: string;
  className?: string;
  variant?: "lime" | "text";
  scope?: AskAiScope;
  recapId?: string | null;
  eventId?: string | null;
  subjectLabel?: string;
  label?: string;
}> = ({
  tenantId,
  tenantName,
  className,
  variant = "lime",
  scope = "tenant",
  recapId,
  eventId,
  subjectLabel,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<JumpOrigin | null>(null);

  if (!tenantId) return null;
  if (scope === "recap" && !recapId) return null;
  if (scope === "event" && !eventId) return null;
  const buttonLabel = label ?? (variant === "text" ? "Ask AI" : "✨ Ask AI");

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          setOrigin(jumpOriginFromElement(e.currentTarget));
          setOpen(true);
        }}
        className={
          variant === "text"
            ? `text-sm font-medium ${className ?? ""}`
            : `px-4 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 ${
                className ?? ""
              }`
        }
        style={
          variant === "text"
            ? {
                background: "transparent",
                color: "rgba(255,255,255,0.62)",
                border: "none",
                padding: 0,
              }
            : limeBtn
        }
        title="Ask AI a question about this client's program"
      >
        {buttonLabel}
      </button>
      {open && (
        <AskAiModal
          tenantId={tenantId}
          tenantName={tenantName}
          scope={scope}
          recapId={recapId}
          eventId={eventId}
          subjectLabel={subjectLabel}
          origin={origin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default AskAiButton;
