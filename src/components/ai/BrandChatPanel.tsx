import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { commitMutation, fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { BrandChatQuery } from "@/api/queries/BrandChatQuery";
import type { BrandChatQuery as BrandChatQueryType } from "@api/queries/__generated__/BrandChatQuery.graphql";
import {
  AskBrandChatMutation,
  ClearBrandChatMutation,
} from "@/api/mutations/BrandChatMutations";
import type { BrandChatMutationsAskMutation } from "@api/mutations/__generated__/BrandChatMutationsAskMutation.graphql";
import type { BrandChatMutationsClearMutation } from "@api/mutations/__generated__/BrandChatMutationsClearMutation.graphql";
import SparkSheet from "@/shared/SparkSheet";
import type { JumpOrigin } from "@/motion/opsMotion";
import AiMarkdown from "./AiMarkdown";

/**
 * Brand chat: docked "Ask Spark" side-panel over the brand's own data.
 *
 * Read-only: nothing here changes anything in Spark except the person's
 * own chat history, which "Clear history" wipes.
 */

type View = NonNullable<BrandChatQueryType["response"]["brandChat"]>;
type Turn = View["turns"][number];

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

const chip: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text-secondary)",
  background: "transparent",
};

const quietBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text-secondary)",
  border: "1px solid var(--spark-border)",
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

function SourceChips({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  if (!turn.sources.length && !turn.links.length) return null;
  const waveAction = turn.sources.find(
    (s) => s.tool === "propose_demo_wave" && s.link.includes("wave=1"),
  );
  const regularSources = turn.sources.filter((s) => s !== waveAction);
  return (
    <div className="mt-2.5 space-y-2">
      {waveAction ? (
        <div
          className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
          style={{
            border: "1px solid var(--spark-border)",
            background: "rgba(var(--spark-ink-rgb),0.03)",
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={TEXT}>
              Draft wave ready{waveAction.detail ? ` · ${waveAction.detail}` : ""}
            </p>
            <p className="text-xs mt-0.5" style={META}>
              Pre-loads stores, dates, and shift hours in Wave Planner — nothing books until you confirm.
            </p>
          </div>
          <Link
            to={waveAction.link}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-xs font-semibold shrink-0 transition hover:opacity-90"
            style={askBtn}
          >
            {waveAction.label} →
          </Link>
        </div>
      ) : null}
      {regularSources.length > 0 || turn.links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Sources">
          {regularSources.map((s) => (
            <Link
              key={s.tool}
              to={s.link}
              onClick={onNavigate}
              className="inline-block max-w-full rounded-lg px-2.5 py-1 text-xs leading-snug transition hover:opacity-80"
              style={chip}
              title={`Open ${s.linkLabel}`}
            >
              <span style={TEXT}>{s.label}</span>
              {s.detail ? <span style={META}> · {s.detail}</span> : null}
            </Link>
          ))}
          {turn.links.map((l) => (
            <Link
              key={l.url}
              to={l.url}
              onClick={onNavigate}
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs transition hover:opacity-80"
              style={chip}
              title={`Open the store page for ${l.label}`}
            >
              Store: {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TurnView({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  const answered = turn.status === "answered";
  return (
    <li className="space-y-2">
      <div className="flex justify-end">
        <p
          className="max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed"
          style={{
            background: "rgba(var(--spark-ink-rgb),0.06)",
            color: "var(--spark-text)",
          }}
        >
          {turn.question}
        </p>
      </div>
      <div className="max-w-[95%]">
        {answered ? (
          <AiMarkdown links={false}>{turn.answer}</AiMarkdown>
        ) : (
          <p className="text-sm" style={META}>
            {turn.answer}
          </p>
        )}
        {STATUS_NOTE[turn.status] ? (
          <p className="text-xs mt-1" style={META}>
            {STATUS_NOTE[turn.status]}
          </p>
        ) : null}
        {answered ? <SourceChips turn={turn} onNavigate={onNavigate} /> : null}
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
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
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
    listEnd.current?.scrollIntoView({ block: "end" });
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
        variables: { tenantId, question: q, conversationId },
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
    [question, pending, tenantId, conversationId],
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
  const rawSuggestions = view?.suggestions ?? [];
  const wavePrompt = "Plan next month's 15-store demo wave";
  const baseSuggestions = rawSuggestions.some((s) => s.toLowerCase().includes("wave"))
    ? rawSuggestions
    : [wavePrompt, ...rawSuggestions.slice(0, 3)];
  const suggestions = routePrompts?.length
    ? Array.from(new Set([...routePrompts, ...baseSuggestions])).slice(0, 4)
    : baseSuggestions;
  const canAsk = Boolean(question.trim()) && !pending && left !== 0 && Boolean(view);

  return (
    <SparkSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="right"
      size="lg"
      eyebrow="Ask Spark"
      title={`Ask about ${brand}'s program`}
    >
      <div className="flex flex-col h-full min-h-[70dvh]">
        <p className="text-xs leading-relaxed" style={META}>
          Grounded strictly in {brand}'s approved recaps, store roster, and POS results — with source links and draft wave previews. Read-only.
        </p>

        {view ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 pb-3" style={{ borderBottom: "1px solid var(--spark-hairline, var(--spark-border))" }}>
            <button
              type="button"
              onClick={newChat}
              disabled={!turns.length || Boolean(pending)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50"
              style={quietBtn}
            >
              New chat
            </button>
            {confirmClear ? (
              <span className="inline-flex items-center gap-2 text-xs" style={META}>
                Clear history?
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={quietBtn}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-xs underline underline-offset-2"
                  style={META}
                >
                  Keep it
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={Boolean(pending)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50"
                style={quietBtn}
              >
                Clear history
              </button>
            )}
            {left != null && view.questionsPerHour ? (
              <span className="text-xs ml-auto tab-num" style={META}>
                {left} / {view.questionsPerHour} left this hr
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex-1 min-h-[200px] overflow-y-auto pr-1" aria-live="polite">
          {loadError ? (
            <p className="text-sm" style={META}>
              {loadError}
            </p>
          ) : !view ? (
            <p className="text-sm" style={META}>
              Loading…
            </p>
          ) : (
            <>
              {turns.length === 0 && !pending ? (
                <div>
                  <p className="text-xs font-medium mb-2" style={META}>
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-left transition hover:opacity-80"
                        style={chip}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <ul className="space-y-5">
                {turns.map((t) => (
                  <TurnView key={t.id} turn={t} onNavigate={onClose} />
                ))}
                {pending ? (
                  <li className="space-y-2">
                    <div className="flex justify-end">
                      <p
                        className="max-w-[85%] rounded-xl px-3.5 py-2 text-sm"
                        style={{ background: "rgba(var(--spark-ink-rgb),0.06)", ...TEXT }}
                      >
                        {pending}
                      </p>
                    </div>
                    <p className="text-sm animate-pulse" style={META}>
                      Checking your data…
                    </p>
                  </li>
                ) : null}
              </ul>
              <div ref={listEnd} />
            </>
          )}
        </div>

        {notice ? (
          <p className="text-xs mt-3" style={META} role="status">
            {notice}
          </p>
        ) : null}

        <form
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (canAsk) ask();
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!view || Boolean(pending)}
            maxLength={500}
            autoFocus
            placeholder={
              left === 0
                ? "No questions left this hour"
                : "Ask about stores, conversion, or shopper feedback…"
            }
            aria-label="Your question"
            className="flex-1 min-w-0 px-3.5 py-2 rounded-lg text-sm transition disabled:opacity-60"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.04)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          />
          <button
            type="submit"
            disabled={!canAsk}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={askBtn}
          >
            Ask
          </button>
        </form>
      </div>
    </SparkSheet>
  );
}
