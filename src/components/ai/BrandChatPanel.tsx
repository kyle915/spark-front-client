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
import SparkOverlay from "@/shared/SparkOverlay";
import type { JumpOrigin } from "@/motion/opsMotion";
import AiMarkdown from "./AiMarkdown";

/**
 * Brand chat: the brand dashboard's Ask AI, as a conversation.
 *
 * A brand user asks things like "Which stores should we hit in December?"
 * and gets an answer worked out from their own data only. The server picks
 * the brand from the person's membership, lets the model call read-only
 * tools pinned to that brand, and keeps an answer only when every number in
 * it came from those tools (else "I couldn't confirm that from your data").
 * Each answer carries small source chips that open the matching page.
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
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
      {turn.sources.map((s) => (
        <Link
          key={s.tool}
          to={s.link}
          onClick={onNavigate}
          className="inline-block max-w-full rounded-2xl px-2.5 py-1 text-xs leading-snug transition hover:opacity-80"
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
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs transition hover:opacity-80"
          style={chip}
          title={`Open the store page for ${l.label}`}
        >
          Store: {l.label}
        </Link>
      ))}
    </div>
  );
}

function TurnView({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  const answered = turn.status === "answered";
  return (
    <li className="space-y-2">
      <div className="flex justify-end">
        <p
          className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
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
  origin = null,
  onClose,
}: {
  tenantId: string;
  origin?: JumpOrigin | null;
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
          setLoadError(v?.reason || "Brand chat isn't available.");
          return;
        }
        setView(v);
        setTurns([...v.turns]);
        setConversationId(v.conversationId ?? null);
        setLeft(v.questionsLeftThisHour);
        if (v.reason) setNotice(v.reason);
      })
      .catch(() => live && setLoadError("Couldn't load brand chat. Try again."));
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
          setNotice("Couldn't reach brand chat. Try again.");
        },
      });
    },
    [question, pending, tenantId, conversationId],
  );

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
  const suggestions = view?.suggestions ?? [];
  const canAsk = Boolean(question.trim()) && !pending && left !== 0 && Boolean(view);

  return (
    <SparkOverlay onClose={onClose} origin={origin} size="lg" label="Ask AI about your program">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--spark-text-secondary)" }}>
            Ask AI
          </p>
          <h2 className="spark-overlay-title">Ask about {brand}'s program</h2>
          <p className="text-sm mt-1" style={META}>
            Answers come only from {brand}'s data in Spark, with the source under each
            answer. Read only: it can't change anything.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium shrink-0 px-2 py-1 rounded-lg"
          style={META}
          aria-label="Close"
        >
          Close
        </button>
      </div>

      {view ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={newChat}
            disabled={!turns.length || Boolean(pending)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
            style={quietBtn}
          >
            New chat
          </button>
          {confirmClear ? (
            <span className="inline-flex items-center gap-2 text-xs" style={META}>
              Clear your chat history for this brand?
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
              style={quietBtn}
            >
              Clear history
            </button>
          )}
          {left != null && view.questionsPerHour ? (
            <span className="text-xs ml-auto" style={META}>
              {left} of {view.questionsPerHour} questions left this hour
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 max-h-[52vh] min-h-[140px] overflow-y-auto pr-1" aria-live="polite">
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
                <p className="text-sm" style={TEXT}>
                  Try one of these, or ask your own:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-left transition hover:opacity-80"
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
                      className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm"
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
        className="mt-3 flex items-center gap-2"
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
            left === 0 ? "No questions left this hour" : "Ask about stores, results or what shoppers said…"
          }
          aria-label="Your question"
          className="flex-1 min-w-0 px-4 py-2 rounded-xl text-sm transition disabled:opacity-60"
          style={{
            background: "rgba(var(--spark-ink-rgb),0.04)",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        />
        <button
          type="submit"
          disabled={!canAsk}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
          style={askBtn}
        >
          Ask
        </button>
      </form>
    </SparkOverlay>
  );
}
