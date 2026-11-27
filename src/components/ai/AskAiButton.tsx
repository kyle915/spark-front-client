import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ArrowUp, ArrowUpRight, Check, Copy, RotateCcw } from "lucide-react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { TenantAiAnswerQuery } from "@/api/queries/TenantAiAnswerQuery";
import type { TenantAiAnswerQuery as TenantAiAnswerQueryType } from "@api/queries/__generated__/TenantAiAnswerQuery.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { dispatchOpenAskSpark } from "@/lib/askSparkEvent";
import AiMarkdown from "./AiMarkdown";
import AiChartView, { type AiChart } from "./AiChartView";
import AskSparkPopoverFrame, { SparkThinkingDots } from "./AskSparkPopoverFrame";
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
import { askAiModalTitle } from "./askAiSubjectName";
import { routeContextLabel } from "./routeAskSparkPrompts";

type DataTurn = {
  id: string;
  question: string;
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: AiChart | null;
  thoughtFor: number | null;
};

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
};

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text-secondary)",
  background: "var(--spark-surface-2)",
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
  contextBadge: string;
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
        contextBadge: "",
        title: askAiModalTitle(tenantName).replace(/\.$/, ""),
        blurb:
          "Answers draw on this client's whole program — every event, recap, and KPI we have.",
        placeholder: "Ask anything about this client's program…",
        followups: ASK_AI_FOLLOWUPS,
      };
    case "recap":
      return {
        kicker: "Ask Spark · Recap",
        contextBadge: "Recap",
        title: subjectLabel ? `Ask about ${subjectLabel}` : "Ask about this recap",
        blurb:
          "Answers use only this recap's filed fields, notes, stored KPIs, and photo metadata.",
        placeholder: "Ask about this recap…",
        followups: RECAP_ASK_AI_FOLLOWUPS,
      };
    case "event":
      return {
        kicker: "Ask Spark · Event",
        contextBadge: "Event",
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

function CopyReplyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      className="inline-flex items-center gap-1 text-[11px] transition hover:opacity-80 cursor-pointer"
      style={{ ...META, background: "transparent", border: "none", padding: 0 }}
      title="Copy answer"
    >
      {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.8} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
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
  const [question, setQuestion] = useState("");
  const [pendingData, setPendingData] = useState<string | null>(null);
  const [dataTurns, setDataTurns] = useState<DataTurn[]>([]);
  const startedAt = useRef(0);
  const listEnd = useRef<HTMLDivElement | null>(null);
  const consumedInitialRef = useRef<string | null>(null);

  const isBusy = Boolean(pendingData);
  const canAsk = question.trim().length > 0 && !isBusy && Boolean(tenantId);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dataTurns.length, pendingData]);

  const ask = useCallback(
    async (raw?: string) => {
      const q = (raw ?? question).trim();
      if (!q || !tenantId || pendingData) return;
      setQuestion("");
      setPendingData(q);
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

        const elapsed = thoughtSeconds(Date.now() - startedAt.current);
        const res = data?.tenantAiAnswer;
        setDataTurns((prev) => [
          ...prev,
          res
            ? {
                id: `d-${Date.now()}-${prev.length}`,
                question: q,
                ok: res.ok,
                answer: res.answer,
                reason: res.reason,
                chart: res.chart,
                thoughtFor: elapsed,
              }
            : {
                id: `dn-${Date.now()}-${prev.length}`,
                question: q,
                ok: false,
                answer: "",
                reason: "No response from the answer service.",
                thoughtFor: elapsed,
              },
        ]);
      } catch {
        const elapsed = thoughtSeconds(Date.now() - startedAt.current);
        setDataTurns((prev) => [
          ...prev,
          {
            id: `de-${Date.now()}-${prev.length}`,
            question: q,
            ok: false,
            answer: "",
            reason: "Couldn't reach the answer service — try again.",
            thoughtFor: elapsed,
          },
        ]);
      } finally {
        setPendingData(null);
      }
    },
    [tenantId, question, pendingData, scope, recapId, eventId],
  );

  useEffect(() => {
    const seeded = (initialQuestion ?? "").trim();
    if (!seeded || !tenantId || consumedInitialRef.current === seeded) return;
    consumedInitialRef.current = seeded;
    void ask(seeded);
  }, [initialQuestion, tenantId, ask]);

  const copy = scopeCopy(scope, tenantName, subjectLabel);
  const pageLabel = copy.contextBadge || routeContextLabel(location.pathname);
  const starterPrompts =
    scope === "tenant" && routePrompts?.length
      ? Array.from(new Set([...routePrompts, ...copy.followups])).slice(0, 4)
      : copy.followups.slice(0, 4);

  const headerExtra =
    dataTurns.length > 0 ? (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px]" style={META}>
          {dataTurns.length} {dataTurns.length === 1 ? "message" : "messages"}
        </span>
        <button
          type="button"
          onClick={() => setDataTurns([])}
          disabled={isBusy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition hover:opacity-80 disabled:opacity-45 cursor-pointer"
          style={{
            background: "transparent",
            color: "var(--spark-text-meta)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <RotateCcw size={11} strokeWidth={1.9} />
          <span>Clear</span>
        </button>
      </div>
    ) : null;

  return (
    <AskSparkPopoverFrame
      title="Ask Spark"
      contextLabel={pageLabel}
      roleBadge={isAdmin ? "Admin" : null}
      subtitle={copy.title}
      headerExtra={headerExtra}
      onClose={onClose}
    >
      {/* Scrollable conversation thread */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4"
        aria-live="polite"
      >
        {dataTurns.length === 0 && !pendingData ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed" style={META}>
              {copy.blurb}
            </p>
            <div className="space-y-1.5">
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={META}
              >
                Suggested for {pageLabel}
              </p>
              <div className="flex flex-col gap-1.5">
                {starterPrompts.map((chipLabel) => (
                  <button
                    key={chipLabel}
                    type="button"
                    onClick={() => void ask(chipLabel)}
                    className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-left transition hover:opacity-90 active:scale-[0.99] cursor-pointer"
                    style={chipStyle}
                  >
                    <span style={TEXT}>{chipLabel}</span>
                    <ArrowUpRight
                      size={13}
                      strokeWidth={1.85}
                      className="shrink-0 opacity-50 group-hover:opacity-100 transition"
                      style={TEXT}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {dataTurns.map((dt) => (
              <li key={dt.id} className="space-y-2.5">
                <div className="flex justify-end">
                  <p
                    className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] leading-relaxed"
                    style={limeBtn}
                  >
                    {dt.question}
                  </p>
                </div>
                <div
                  className="rounded-2xl rounded-tl-md px-3.5 py-3 text-[13.5px] space-y-2.5"
                  style={{
                    background: "rgba(var(--spark-ink-rgb),0.03)",
                    border: "1px solid var(--spark-hairline, var(--spark-border))",
                  }}
                >
                  {dt.ok ? (
                    <>
                      <AiMarkdown>{dt.answer}</AiMarkdown>
                      {dt.chart ? <AiChartView chart={dt.chart} /> : null}
                      <div
                        className="pt-2 flex items-center justify-between text-[11px]"
                        style={{
                          ...META,
                          borderTop:
                            "1px solid var(--spark-hairline, var(--spark-border))",
                        }}
                      >
                        {dt.answer ? <CopyReplyButton text={dt.answer} /> : <span />}
                        {dt.thoughtFor != null ? (
                          <span>{thoughtLabel(dt.thoughtFor)}</span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px]" style={META}>
                      {dt.reason || "Couldn't answer that from this client's data."}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {pendingData ? (
              <li className="space-y-2.5">
                <div className="flex justify-end">
                  <p
                    className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px]"
                    style={limeBtn}
                  >
                    {pendingData}
                  </p>
                </div>
                <SparkThinkingDots label="Checking program data…" />
              </li>
            ) : null}
          </ul>
        )}
        <div ref={listEnd} />
      </div>

      {/* Sticky bottom composer */}
      <form
        className="shrink-0 px-3.5 pt-2.5 pb-3"
        style={{
          borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
          background: "var(--spark-surface)",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canAsk) void ask();
        }}
      >
        <div
          className="flex items-center gap-1.5 rounded-xl pl-3 pr-1.5 py-1.5 transition"
          style={{
            background: "var(--spark-surface-2)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isBusy}
            autoFocus
            placeholder={copy.placeholder}
            aria-label="Ask Spark"
            className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none disabled:opacity-60"
            style={{ color: "var(--spark-text)" }}
          />
          <button
            type="submit"
            disabled={!canAsk}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:opacity-90 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            style={limeBtn}
            aria-label="Send question"
            title="Ask Spark"
          >
            <ArrowUp size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-1.5 px-0.5 flex items-center justify-between text-[10.5px]" style={META}>
          <span>Grounded in Spark program data</span>
          <span className="hidden md:inline">⌘J to toggle · Esc to close</span>
        </div>
      </form>
    </AskSparkPopoverFrame>
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
          // Tenant-level buttons hand off directly to the unified bottom-right Ask Spark pop-up.
          if (scope === "tenant") {
            dispatchOpenAskSpark({ tenantId });
            return;
          }
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
            ? "Open Ask Spark pop-up for your program"
            : "Open Ask Spark pop-up"
        }
      >
        {buttonLabel}
      </button>
      {open && scope !== "tenant" ? (
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
      ) : null}
    </>
  );
};

export default AskAiButton;
