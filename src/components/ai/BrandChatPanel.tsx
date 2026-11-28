import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowUpRight,
  CornerDownRight,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { CopyMorphButton } from "@/motion/CopyMorphButton";
import { PaperPlaneSendButton } from "@/motion/FeedbackActionButton";
import { commitMutation, fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { BrandChatQuery } from "@/api/queries/BrandChatQuery";
import type { BrandChatQuery as BrandChatQueryType } from "@api/queries/__generated__/BrandChatQuery.graphql";
import {
  AskBrandChatMutation,
  ClearBrandChatMutation,
  ReportBrandChatUnhelpfulMutation,
} from "@/api/mutations/BrandChatMutations";
import type { BrandChatMutationsAskMutation } from "@api/mutations/__generated__/BrandChatMutationsAskMutation.graphql";
import type { BrandChatMutationsClearMutation } from "@api/mutations/__generated__/BrandChatMutationsClearMutation.graphql";
import type { BrandChatMutationsReportUnhelpfulMutation } from "@api/mutations/__generated__/BrandChatMutationsReportUnhelpfulMutation.graphql";
import type { JumpOrigin } from "@/motion/opsMotion";
import AiMarkdown from "./AiMarkdown";
import AskSparkPopoverFrame, { SparkThinkingDots } from "./AskSparkPopoverFrame";
import {
  AskSparkEvidenceBar,
  AskSparkPendingStatus,
} from "./AskSparkGroundingBar";
import { deriveAskSparkFollowups } from "./askSparkFollowups";
import { routeContextLabel } from "./routeAskSparkPrompts";

/**
 * Client Ask Spark floating bottom-right pop-up.
 *
 * Read-only multi-turn chat grounded strictly in the brand's own approved
 * recaps, store roster, POS lift, and wave planner.
 */

type View = NonNullable<BrandChatQueryType["response"]["brandChat"]>;
type Turn = View["turns"][number];

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

const chip: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text-secondary)",
  background: "var(--spark-surface-2)",
};

const askBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
};

const STATUS_NOTE: Record<string, string> = {
  not_grounded: "Not shown: a figure in the draft answer didn't match your data.",
  failed: "",
  limited: "",
};

function CopyReplyButton({ text }: { text: string }) {
  return (
    <CopyMorphButton
      text={text}
      label="Copy"
      copiedLabel="Copied"
      title="Copy answer"
      className="text-[11px]"
      style={{ ...META, background: "transparent", border: "none", padding: 0 }}
      iconSize={11}
    />
  );
}

function SourceChips({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  const waveAction = turn.sources.find(
    (s) => s.tool === "propose_demo_wave" && s.link.includes("wave=1"),
  );
  const regularSources = turn.sources.filter((s) => s !== waveAction);
  const evidenceCount = regularSources.length + turn.links.length;

  return (
    <div className="space-y-2">
      <AskSparkEvidenceBar
        sourceCount={evidenceCount}
        scopeLabel="approved program data"
      >
        {evidenceCount > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Sources">
            {regularSources.map((s) => (
              <Link
                key={s.tool}
                to={s.link}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 max-w-full rounded-lg px-2.5 py-1 text-[11.5px] leading-snug no-underline transition hover:opacity-80"
                style={chip}
                title={`Open ${s.linkLabel}`}
              >
                <span style={TEXT}>{s.label}</span>
                {s.detail ? <span style={META}>· {s.detail}</span> : null}
                <ArrowUpRight size={11} strokeWidth={1.8} style={META} />
              </Link>
            ))}
            {turn.links.map((l) => (
              <Link
                key={l.url}
                to={l.url}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] no-underline transition hover:opacity-80"
                style={chip}
                title={`Open the store page for ${l.label}`}
              >
                <span style={TEXT}>Store: {l.label}</span>
                <ArrowUpRight size={11} strokeWidth={1.8} style={META} />
              </Link>
            ))}
          </div>
        ) : undefined}
      </AskSparkEvidenceBar>
      {waveAction ? (
        <div
          className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5"
          style={{
            border: "1px solid var(--spark-border)",
            background: "var(--spark-surface-2)",
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={TEXT}>
              Draft wave ready{waveAction.detail ? ` · ${waveAction.detail}` : ""}
            </p>
            <p className="text-[11.5px] mt-0.5 leading-snug" style={META}>
              Pre-loads stores, dates, and hours in Wave Planner — nothing books until you confirm.
            </p>
          </div>
          <Link
            to={waveAction.link}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 no-underline transition hover:opacity-90 active:scale-[0.98]"
            style={askBtn}
          >
            {waveAction.label}
            <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function TurnView({
  turn,
  flagged,
  onFlagUnhelpful,
  onNavigate,
}: {
  turn: Turn;
  flagged: boolean;
  onFlagUnhelpful: (turnId: string) => void;
  onNavigate: () => void;
}) {
  const answered = turn.status === "answered";
  return (
    <li className="space-y-2.5">
      <div className="flex justify-end">
        <p
          className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] leading-relaxed"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          {turn.question}
        </p>
      </div>
      <div
        className="rounded-2xl rounded-tl-md px-3.5 py-3 text-[13.5px]"
        style={{
          background: "rgba(var(--spark-ink-rgb),0.03)",
          border: "1px solid var(--spark-hairline, var(--spark-border))",
        }}
      >
        {answered ? <SourceChips turn={turn} onNavigate={onNavigate} /> : null}
        {answered ? (
          <AiMarkdown links={false}>{turn.answer}</AiMarkdown>
        ) : (
          <p className="text-[13px]" style={META}>
            {turn.answer}
          </p>
        )}
        {STATUS_NOTE[turn.status] ? (
          <p className="text-xs mt-1.5" style={META}>
            {STATUS_NOTE[turn.status]}
          </p>
        ) : null}
        {answered || turn.status === "not_grounded" ? (
          <div
            className="mt-2.5 pt-2 flex items-center justify-between gap-3"
            style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
          >
            {answered && turn.answer ? <CopyReplyButton text={turn.answer} /> : <span />}
            {flagged ? (
              <span className="text-[11px]" style={META}>
                Flagged for your Ignite team — thanks!
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onFlagUnhelpful(String(turn.id))}
                className="text-[11px] underline underline-offset-2 transition hover:opacity-80 cursor-pointer"
                style={{ ...META, background: "transparent", border: "none", padding: 0 }}
              >
                Not helpful?
              </button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function BrandChatPanel({
  tenantId,
  initialQuestion,
  routePrompts,
  onClose,
}: {
  tenantId: string;
  origin?: JumpOrigin | null;
  initialQuestion?: string;
  routePrompts?: readonly string[];
  onClose: () => void;
}) {
  const location = useLocation();
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const listEnd = useRef<HTMLDivElement | null>(null);
  const consumedInitialRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchQuery<BrandChatQueryType>(
      environment,
      BrandChatQuery,
      { tenantId, conversationId: null },
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .then((data) => {
        if (!live) return;
        const v = data?.brandChat;
        if (!v || !v.ok) {
          setLoadError(v?.reason || "Ask Spark isn't available.");
          return;
        }
        setView(v);
        setTurns([...v.turns]);
        setConversationId(v.conversationId ?? null);
        setLeft(v.questionsLeftThisHour);
        if (v.reason) setNotice(v.reason);
      })
      .catch(() => live && setLoadError("Couldn't load Ask Spark. Try again."));
    return () => {
      live = false;
    };
  }, [tenantId]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  const ask = useCallback(
    (raw?: string) => {
      const q = (raw ?? question).trim();
      if (!q || pending) return;
      setPending(q);
      setQuestion("");
      setNotice(null);
      commitMutation<BrandChatMutationsAskMutation>(environment, {
        mutation: AskBrandChatMutation,
        variables: {
          tenantId,
          question: q,
          conversationId,
          currentPath: location.pathname || "/",
        },
        onCompleted: (res) => {
          const reply = res.askBrandChat;
          setPending(null);
          setLeft(reply.questionsLeftThisHour);
          if (reply.turn) {
            setTurns((prev) => [...prev, reply.turn!]);
            setConversationId(reply.conversationId ?? null);
          } else if (reply.reason) {
            setNotice(reply.reason);
            setQuestion(q);
          }
        },
        onError: () => {
          setPending(null);
          setQuestion(q);
          setNotice("Couldn't reach Ask Spark. Try again.");
        },
      });
    },
    [question, pending, tenantId, conversationId, location.pathname],
  );

  const flagUnhelpful = useCallback(
    (turnId: string) => {
      setFlaggedIds((prev) => ({ ...prev, [turnId]: true }));
      commitMutation<BrandChatMutationsReportUnhelpfulMutation>(environment, {
        mutation: ReportBrandChatUnhelpfulMutation,
        variables: { turnId, currentPath: location.pathname || "/" },
      });
    },
    [location.pathname],
  );

  useEffect(() => {
    const seeded = (initialQuestion ?? "").trim();
    if (!seeded || !view || pending || left === 0) return;
    if (consumedInitialRef.current === seeded) return;
    consumedInitialRef.current = seeded;
    ask(seeded);
  }, [initialQuestion, view, pending, left, ask]);

  const newChat = () => {
    setTurns([]);
    setConversationId(null);
    setNotice(null);
    setConfirmClear(false);
  };

  const clearAll = () => {
    commitMutation<BrandChatMutationsClearMutation>(environment, {
      mutation: ClearBrandChatMutation,
      variables: { tenantId, conversationId: null },
      onCompleted: (res) => {
        setConfirmClear(false);
        if (res.clearBrandChat.ok) {
          newChat();
          setNotice("Your chat history for this brand was cleared.");
        } else {
          setNotice(res.clearBrandChat.reason || "History could not be cleared.");
        }
      },
      onError: () => {
        setConfirmClear(false);
        setNotice("History could not be cleared. Try again.");
      },
    });
  };

  const brand = view?.brandName || "your brand";
  const pageLabel = routeContextLabel(location.pathname);
  const rawSuggestions = view?.suggestions ?? [];
  const wavePrompt = "Plan next month's 15-store demo wave";
  const baseSuggestions = rawSuggestions.some((s) => s.toLowerCase().includes("wave"))
    ? rawSuggestions
    : [wavePrompt, ...rawSuggestions.slice(0, 3)];
  const merged = routePrompts?.length
    ? [...routePrompts.slice(0, 3), ...baseSuggestions]
    : baseSuggestions;
  const dataSuggestions = Array.from(new Set(merged.filter(Boolean))).slice(0, 4);

  const canAsk = Boolean(question.trim()) && !pending && left !== 0 && Boolean(view);

  const headerActions =
    turns.length > 0 ? (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px]" style={META}>
          {turns.length} {turns.length === 1 ? "message" : "messages"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={newChat}
            disabled={Boolean(pending)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition hover:opacity-80 disabled:opacity-45 cursor-pointer"
            style={{
              background: "transparent",
              color: "var(--spark-text-meta)",
              border: "1px solid var(--spark-border)",
            }}
            title="Start a fresh conversation"
          >
            <RotateCcw size={11} strokeWidth={1.9} />
            <span>New chat</span>
          </button>
          {confirmClear ? (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={META}>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                style={{
                  background: "rgba(210,72,27,0.12)",
                  color: "var(--spark-flag-ink, #a8340f)",
                  border: "none",
                }}
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-[11px] underline cursor-pointer"
                style={{ ...META, background: "transparent", border: "none", padding: 0 }}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={Boolean(pending)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg transition hover:opacity-80 disabled:opacity-45 cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--spark-text-meta)",
                border: "none",
              }}
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 size={12} strokeWidth={1.85} />
            </button>
          )}
        </div>
      </div>
    ) : null;

  return (
    <AskSparkPopoverFrame
      title="Ask Spark"
      contextLabel={pageLabel}
      subtitle={`Grounded in ${brand}'s approved program data`}
      headerExtra={headerActions}
      onClose={onClose}
    >
      {/* Scrollable thread */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4"
        aria-live="polite"
      >
        {loadError ? (
          <p className="text-sm" style={META}>
            {loadError}
          </p>
        ) : !view ? (
          <div className="space-y-2.5 pt-2">
            <SparkThinkingDots label="Loading your program context…" />
          </div>
        ) : (
          <>
            {turns.length === 0 && !pending ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed" style={META}>
                  Ask about {brand}&apos;s stores, conversion, POS lift, shopper voice, or plan your next demo wave. Read-only.
                </p>
                <div className="space-y-1.5">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={META}
                  >
                    Try asking on {pageLabel}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {dataSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-left transition hover:opacity-90 active:scale-[0.99] cursor-pointer"
                        style={chip}
                      >
                        <span style={TEXT}>{s}</span>
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
            ) : null}

            {turns.length > 0 || pending ? (
              <ul className="space-y-4">
                {turns.map((t, idx) => {
                  const isLatest = idx === turns.length - 1;
                  const followups =
                    isLatest && !pending && left !== 0 && t.status === "answered"
                      ? deriveAskSparkFollowups({
                          question: t.question,
                          answer: t.answer,
                          sourceTools: t.sources.map((s) => s.tool),
                          pathname: location.pathname,
                          priorQuestions: turns.slice(0, idx).map((p) => p.question),
                        })
                      : [];
                  return (
                    <Fragment key={t.id}>
                      <TurnView
                        turn={t}
                        flagged={Boolean(flaggedIds[String(t.id)])}
                        onFlagUnhelpful={flagUnhelpful}
                        onNavigate={onClose}
                      />
                      {followups.length > 0 ? (
                        <li
                          className="flex flex-wrap gap-1.5 pt-0.5"
                          aria-label="Follow-up prompts"
                        >
                          {followups.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => ask(prompt)}
                              className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-left transition hover:opacity-85 active:scale-[0.98] cursor-pointer"
                              style={chip}
                            >
                              <CornerDownRight
                                size={11}
                                strokeWidth={2}
                                className="shrink-0 opacity-60 group-hover:opacity-100"
                                style={TEXT}
                              />
                              <span style={TEXT}>{prompt}</span>
                            </button>
                          ))}
                        </li>
                      ) : null}
                    </Fragment>
                  );
                })}
                {pending ? (
                  <li className="space-y-2.5">
                    <div className="flex justify-end">
                      <p
                        className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px]"
                        style={{
                          background: "var(--spark-lime)",
                          color: "var(--spark-on-accent)",
                        }}
                      >
                        {pending}
                      </p>
                    </div>
                    <AskSparkPendingStatus isClient />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </>
        )}
        <div ref={listEnd} />
      </div>

      {/* Notice banner */}
      {notice ? (
        <p className="px-4 pb-1.5 text-[11.5px]" style={META} role="status">
          {notice}
        </p>
      ) : null}

      {/* Sticky composer */}
      <form
        className="shrink-0 px-3.5 pt-2.5 pb-3"
        style={{
          borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
          background: "var(--spark-surface)",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canAsk) ask();
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
            disabled={Boolean(pending) || !view}
            maxLength={500}
            autoFocus
            placeholder={
              left === 0
                ? "No questions left this hour"
                : "Ask about stores, conversion, POS, or next wave…"
            }
            aria-label="Ask Spark"
            className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none disabled:opacity-60"
            style={{ color: "var(--spark-text)" }}
          />
          <PaperPlaneSendButton
            type="submit"
            iconOnly
            busy={Boolean(pending)}
            disabled={!canAsk}
            className={`h-8 w-8 shrink-0 rounded-lg transition hover:opacity-90 active:scale-95 ${pending ? "" : "disabled:opacity-35"} disabled:cursor-not-allowed cursor-pointer`}
            style={askBtn}
            aria-label="Send question"
            title="Send (Enter)"
          />
        </div>

        <div className="mt-1.5 px-0.5 flex items-center justify-between text-[10.5px]" style={META}>
          <span>Read-only · Approved program data</span>
          {left != null && view?.questionsPerHour ? (
            <span className="tab-num">
              {left}/{view.questionsPerHour} left this hr
            </span>
          ) : (
            <span className="hidden md:inline">⌘J to toggle · Esc to close</span>
          )}
        </div>
      </form>
    </AskSparkPopoverFrame>
  );
}
