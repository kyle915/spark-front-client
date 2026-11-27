import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { commitMutation, fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { TenantAiAnswerQuery } from "@/api/queries/TenantAiAnswerQuery";
import type { TenantAiAnswerQuery as TenantAiAnswerQueryType } from "@api/queries/__generated__/TenantAiAnswerQuery.graphql";
import { AskSparkHelpMutation } from "@/api/mutations/BrandChatMutations";
import type { BrandChatMutationsAskHelpMutation } from "@api/mutations/__generated__/BrandChatMutationsAskHelpMutation.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { confidenceBadgeMeta } from "@/components/pages/help/helpKnowledgeHelpers";
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
import SparkSheet from "@/shared/SparkSheet";
import { askAiModalTitle } from "./askAiSubjectName";
import { routeAskSparkPrompts, routeSparkHelpPrompts } from "./routeAskSparkPrompts";
import BrandChatPanel from "./BrandChatPanel";

type AiAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: AiChart | null;
};

type HelpAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
  confidence: string;
  matchedVia: string;
  gapLogged: boolean;
  isAdminScope: boolean;
  sources: ReadonlyArray<{
    title: string;
    routePath: string;
    routeLabel: string;
    audience: string;
  }>;
};

const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
};

const triggerBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

const ghostTriggerBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
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
        kicker: "Ask Spark",
        title: askAiModalTitle(tenantName).replace(/\.$/, ""),
        blurb:
          "Answers draw on this client's whole program — every event, recap, and KPI we have.",
        placeholder: "Ask anything about this client's program…",
        followups: ASK_AI_FOLLOWUPS,
      };
    case "recap":
      return {
        kicker: "Ask Spark · Recap",
        title: subjectLabel ? `Ask about ${subjectLabel}` : "Ask about this recap",
        blurb:
          "Answers use only this recap's filed fields, notes, stored KPIs, and photo metadata.",
        placeholder: "Ask about this recap…",
        followups: RECAP_ASK_AI_FOLLOWUPS,
      };
    case "event":
      return {
        kicker: "Ask Spark · Event",
        title: subjectLabel ? `Ask about ${subjectLabel}` : "Ask about this event",
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

export const AskAiModal: React.FC<{
  tenantId: string;
  tenantName?: string;
  scope: AskAiScope;
  recapId?: string | null;
  eventId?: string | null;
  subjectLabel?: string;
  origin?: JumpOrigin | null;
  initialQuestion?: string;
  routePrompts?: readonly string[];
  onClose: () => void;
}> = ({
  tenantId,
  tenantName,
  scope,
  recapId,
  eventId,
  subjectLabel,
  initialQuestion,
  routePrompts,
  onClose,
}) => {
  const location = useLocation();
  const { isAdmin } = useSparkRole();
  const [mode, setMode] = useState<"data" | "help">("data");
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswerResult | null>(null);
  const [helpResult, setHelpResult] = useState<HelpAnswerResult | null>(null);
  const [thoughtFor, setThoughtFor] = useState<number | null>(null);
  const startedAt = useRef(0);
  const consumedInitialRef = useRef<string | null>(null);

  const trimmed = question.trim();
  const canAsk = trimmed.length > 0 && !loading && (mode === "help" || Boolean(tenantId));

  const askHelp = useCallback(
    (raw?: string) => {
      const q = (raw ?? question).trim();
      if (!q) return;
      setMode("help");
      setQuestion(q);
      setLoading(true);
      setThoughtFor(null);
      startedAt.current = Date.now();
      commitMutation<BrandChatMutationsAskHelpMutation>(environment, {
        mutation: AskSparkHelpMutation,
        variables: {
          question: q,
          currentPath: location.pathname || "/",
          tenantId: tenantId || null,
          previewAsClient: !isAdmin,
        },
        onCompleted: (res) => {
          const r = res.askSparkHelp;
          setHelpResult({
            ok: r.ok,
            answer: r.answer,
            reason: r.reason,
            confidence: r.confidence,
            matchedVia: r.matchedVia,
            gapLogged: r.gapLogged,
            isAdminScope: r.isAdminScope,
            sources: r.sources,
          });
          setThoughtFor(thoughtSeconds(Date.now() - startedAt.current));
          setLoading(false);
        },
        onError: () => {
          setHelpResult({
            ok: false,
            answer: "",
            reason: "Couldn't reach Spark Help — try again.",
            confidence: "low",
            matchedVia: "bm25",
            gapLogged: false,
            isAdminScope: isAdmin,
            sources: [],
          });
          setThoughtFor(thoughtSeconds(Date.now() - startedAt.current));
          setLoading(false);
        },
      });
    },
    [question, location.pathname, tenantId, isAdmin],
  );

  const ask = useCallback(async (raw?: string) => {
    const q = (raw ?? question).trim();
    if (!q || !tenantId) return;
    setMode("data");
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

  useEffect(() => {
    const seeded = (initialQuestion ?? "").trim();
    if (!seeded || !tenantId || consumedInitialRef.current === seeded) return;
    consumedInitialRef.current = seeded;
    void ask(seeded);
  }, [initialQuestion, tenantId, ask]);

  const copy = scopeCopy(scope, tenantName, subjectLabel);
  const helpPrompts = routeSparkHelpPrompts(location.pathname, !isAdmin);
  const starterPrompts =
    mode === "help"
      ? helpPrompts
      : scope === "tenant" && routePrompts?.length
        ? Array.from(new Set([...routePrompts, ...copy.followups])).slice(0, 4)
        : copy.followups;

  return (
    <SparkSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="right"
      size="lg"
      eyebrow={mode === "help" ? (isAdmin ? "Ask Spark · Admin Help" : "Ask Spark · Help") : copy.kicker}
      title={mode === "help" ? "Spark Product Help" : copy.title}
    >
      <div className="flex flex-col h-full min-h-[65dvh]">
        {scope === "tenant" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="pill-group" role="group" aria-label="Ask Spark mode">
              <button
                type="button"
                className={`pill-btn ${mode === "data" ? "on" : ""}`}
                onClick={() => setMode("data")}
              >
                Program Data
              </button>
              <button
                type="button"
                className={`pill-btn ${mode === "help" ? "on" : ""}`}
                onClick={() => setMode("help")}
              >
                {isAdmin ? "Spark Help (Admin)" : "Spark Help"}
              </button>
            </div>
            {isAdmin && mode === "help" ? (
              <Link
                to="/help-knowledge"
                onClick={onClose}
                className="text-xs font-semibold underline underline-offset-2"
                style={{ color: "var(--spark-ok-ink, var(--spark-text))" }}
              >
                Manage Knowledge &amp; Gaps →
              </Link>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs leading-relaxed" style={{ color: "var(--spark-text-meta)" }}>
          {mode === "help"
            ? isAdmin
              ? `Route-aware Spark product help (${location.pathname || "/"}) grounded in Spark guides and OpenAI semantic embeddings. Never discusses internal Ignite financials or processes.`
              : `Route-aware Spark product help (${location.pathname || "/"}) grounded in Spark guides.`
            : copy.blurb}
        </p>

        <form
          className="mt-3 flex items-center gap-2 flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAsk) return;
            if (mode === "help") {
              askHelp();
            } else {
              void ask();
            }
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            autoFocus
            placeholder={
              mode === "help"
                ? "Ask how any Spark page or feature works…"
                : copy.placeholder
            }
            className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg text-sm transition disabled:opacity-60"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.04)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          />
          <button
            type="submit"
            disabled={!canAsk}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={limeBtn}
            title={mode === "help" ? "Search Spark Help" : "Ask Spark about this program"}
          >
            Ask
          </button>
        </form>

        {!(mode === "help" ? helpResult : result) && !loading ? (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--spark-text-meta)" }}>
              {mode === "help" ? "Suggested help questions" : "Suggested questions"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {starterPrompts.map((chipLabel) => (
                <button
                  key={chipLabel}
                  type="button"
                  className="spark-ops-chip"
                  onClick={() => (mode === "help" ? askHelp(chipLabel) : void ask(chipLabel))}
                >
                  {chipLabel}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 space-y-2">
            {trimmed ? (
              <p
                className="rounded-xl px-3.5 py-2 text-sm leading-relaxed"
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.05)",
                  color: "var(--spark-text)",
                }}
              >
                {trimmed}
              </p>
            ) : null}
            <p className="spark-ops-thinking">
              {mode === "help" ? "Searching Spark Knowledge…" : "Checking program data…"}
            </p>
          </div>
        ) : thoughtFor != null ? (
          <p className="spark-ops-thought mt-4">{thoughtLabel(thoughtFor)}</p>
        ) : null}

        {mode === "help" && helpResult && !loading && (
          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3">
            {helpResult.ok ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const meta = confidenceBadgeMeta(helpResult.confidence);
                    return (
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}
                      >
                        {meta.label}
                      </span>
                    );
                  })()}
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] mono"
                    style={{
                      background: "var(--spark-surface-2)",
                      color: "var(--spark-text-meta)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    {helpResult.matchedVia === "hybrid" ? "Semantic + BM25" : "BM25"}
                  </span>
                  {helpResult.gapLogged && isAdmin ? (
                    <Link
                      to="/help-knowledge"
                      onClick={onClose}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold no-underline"
                      style={{
                        background: "rgba(210,72,27,0.10)",
                        color: "var(--spark-flag-ink, #a8340f)",
                        border: "1px solid rgba(210,72,27,0.28)",
                      }}
                    >
                      Logged to Knowledge Gaps →
                    </Link>
                  ) : null}
                </div>
                <AiMarkdown links={false}>{helpResult.answer}</AiMarkdown>
                {helpResult.sources.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {helpResult.sources.map((s) => (
                      <Link
                        key={`${s.title}-${s.routePath}`}
                        to={s.routePath || "/setup-guide"}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium no-underline transition hover:opacity-80"
                        style={{
                          border: "1px solid var(--spark-border)",
                          color: "var(--spark-text)",
                          background: "var(--spark-surface-2)",
                        }}
                      >
                        <span>{s.routeLabel || s.title} →</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="spark-ops-followups">
                  {helpPrompts.map((chipLabel) => (
                    <button
                      key={chipLabel}
                      type="button"
                      className="spark-ops-chip"
                      onClick={() => askHelp(chipLabel)}
                    >
                      {chipLabel}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
                {helpResult.reason || "Couldn't answer that from Spark Help."}
              </p>
            )}
          </div>
        )}

        {mode === "data" && result && !loading && (
          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            {result.ok ? (
              <>
                <AiMarkdown>{result.answer}</AiMarkdown>
                {result.chart ? <AiChartView chart={result.chart} /> : null}
                <div className="spark-ops-followups">
                  {starterPrompts.map((chipLabel) => (
                    <button
                      key={chipLabel}
                      type="button"
                      className="spark-ops-chip"
                      onClick={() => void ask(chipLabel)}
                    >
                      {chipLabel}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p
                className="text-sm"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {result.reason ||
                  "Couldn't answer that from this client's data."}
              </p>
            )}
          </div>
        )}
      </div>
    </SparkSheet>
  );
};

const AskAiButton: React.FC<{
  tenantId: string | null | undefined;
  tenantName?: string;
  className?: string;
  variant?: "lime" | "text" | "ghost";
  scope?: AskAiScope;
  recapId?: string | null;
  eventId?: string | null;
  subjectLabel?: string;
  label?: string;
  chat?: boolean;
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
  chat = false,
}) => {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<JumpOrigin | null>(null);

  if (!tenantId) return null;
  if (scope === "recap" && !recapId) return null;
  if (scope === "event" && !eventId) return null;
  const buttonLabel = label ?? "Ask Spark";

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
            : `px-3.5 py-2 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5 whitespace-nowrap ${
                className ?? ""
              }`
        }
        style={
          variant === "text"
            ? {
                background: "transparent",
                color: "var(--spark-text-secondary)",
                border: "none",
                padding: 0,
              }
            : variant === "ghost"
              ? ghostTriggerBtn
              : triggerBtn
        }
        title={
          chat
            ? "Open Ask Spark side-panel for your program"
            : "Open Ask Spark side-panel"
        }
      >
        {buttonLabel}
      </button>
      {open && chat && scope === "tenant" ? (
        <BrandChatPanel
          tenantId={tenantId}
          origin={origin}
          routePrompts={routeAskSparkPrompts(
            typeof window !== "undefined" ? window.location.pathname : "/",
            true,
          )}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {open && !(chat && scope === "tenant") && (
        <AskAiModal
          tenantId={tenantId}
          tenantName={tenantName}
          scope={scope}
          recapId={recapId}
          eventId={eventId}
          subjectLabel={subjectLabel}
          origin={origin}
          routePrompts={
            scope === "tenant"
              ? routeAskSparkPrompts(
                  typeof window !== "undefined" ? window.location.pathname : "/",
                  false,
                )
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default AskAiButton;
