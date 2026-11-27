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
import SparkSheet from "@/shared/SparkSheet";
import { askAiModalTitle } from "./askAiSubjectName";
import { routeAskSparkPrompts } from "./routeAskSparkPrompts";
import BrandChatPanel from "./BrandChatPanel";

type AiAnswerResult = {
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: AiChart | null;
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
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswerResult | null>(null);
  const [thoughtFor, setThoughtFor] = useState<number | null>(null);
  const startedAt = useRef(0);
  const consumedInitialRef = useRef<string | null>(null);

  const trimmed = question.trim();
  const canAsk = trimmed.length > 0 && !loading && Boolean(tenantId);

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

  useEffect(() => {
    const seeded = (initialQuestion ?? "").trim();
    if (!seeded || !tenantId || consumedInitialRef.current === seeded) return;
    consumedInitialRef.current = seeded;
    void ask(seeded);
  }, [initialQuestion, tenantId, ask]);

  const copy = scopeCopy(scope, tenantName, subjectLabel);
  const starterPrompts =
    scope === "tenant" && routePrompts?.length
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
      eyebrow={copy.kicker}
      title={copy.title}
    >
      <div className="flex flex-col h-full min-h-[65dvh]">
        <p className="text-xs leading-relaxed" style={{ color: "var(--spark-text-meta)" }}>
          {copy.blurb}
        </p>

        <form
          className="mt-3 flex items-center gap-2 flex-wrap"
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
            title="Ask Spark about this program"
          >
            Ask
          </button>
        </form>

        {!result && !loading ? (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--spark-text-meta)" }}>
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-1.5">
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
            <p className="spark-ops-thinking">Checking program data…</p>
          </div>
        ) : thoughtFor != null ? (
          <p className="spark-ops-thought mt-4">{thoughtLabel(thoughtFor)}</p>
        ) : null}

        {result && !loading && (
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
