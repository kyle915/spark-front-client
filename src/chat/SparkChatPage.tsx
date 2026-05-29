import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import Layout from "@/layout/Layout";
import environment from "@/api/relay/environment";
import { ChatThreadsQuery } from "@/api/queries/ChatThreadsQuery";
import type { ChatThreadsQuery as ChatThreadsQueryType } from "@api/queries/__generated__/ChatThreadsQuery.graphql";
import { ChatThreadQuery } from "@/api/queries/ChatThreadQuery";
import type { ChatThreadQuery as ChatThreadQueryType } from "@api/queries/__generated__/ChatThreadQuery.graphql";
import { SendChatMessageMutation } from "@/api/mutations/SendChatMessageMutation";
import type { SendChatMessageMutation as SendChatMessageMutationType } from "@api/mutations/__generated__/SendChatMessageMutation.graphql";
import { MarkChatThreadReadMutation } from "@/api/mutations/MarkChatThreadReadMutation";
import type { MarkChatThreadReadMutation as MarkChatThreadReadMutationType } from "@api/mutations/__generated__/MarkChatThreadReadMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import BroadcastComposer from "./BroadcastComposer";

/* ─── Attachment rendering ─── */

type ChatAttachment = {
  readonly uuid: string;
  readonly kind: string;
  readonly url: string | null | undefined;
  readonly originalFilename: string | null | undefined;
  readonly byteSize?: number | null;
};

/**
 * Renders a message's attachments: images inline as thumbnails that open
 * full-size in a new tab; PDFs / other files as a tappable "📎 filename"
 * chip that opens the URL. A message with only an attachment + empty
 * body still shows the attachment (the body <p> is omitted upstream).
 */
const MessageAttachments: React.FC<{
  attachments: ReadonlyArray<ChatAttachment> | null | undefined;
  mine: boolean;
}> = ({ attachments, mine }) => {
  const items = (attachments ?? []).filter((a) => a && a.url);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mt-1">
      {items.map((a) => {
        if (a.kind === "image") {
          return (
            <a
              key={a.uuid}
              href={a.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              style={{ display: "block" }}
            >
              <img
                src={a.url ?? ""}
                alt={a.originalFilename ?? "attachment"}
                style={{
                  maxWidth: 220,
                  maxHeight: 220,
                  borderRadius: 10,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </a>
          );
        }
        return (
          <a
            key={a.uuid}
            href={a.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
            style={{
              background: mine ? "rgba(10,13,9,0.12)" : "rgba(255,255,255,0.07)",
              color: mine ? "#0a0d09" : "var(--spark-text)",
              border: mine
                ? "1px solid rgba(10,13,9,0.2)"
                : "1px solid var(--spark-border)",
              textDecoration: "none",
              maxWidth: 240,
            }}
          >
            <span>📎</span>
            <span className="truncate">
              {a.originalFilename ?? "Attachment"}
            </span>
          </a>
        );
      })}
    </div>
  );
};

/**
 * Admin-side chat page — split layout, thread list on the left,
 * conversation pane on the right. Mirrors the mobile inbox shape
 * but with the admin-side unread counts (unreadForAdmin).
 *
 * Polling: thread list refreshes every 30s while the page is open;
 * the active conversation refreshes every 15s. Both stop when the
 * tab is hidden (Page Visibility API) — push notifications still
 * deliver while the admin is elsewhere on the site, and the
 * sidebar badge picks up the count on the next 60s tick.
 */

const THREAD_LIST_POLL_MS = 30 * 1000;
const ACTIVE_THREAD_POLL_MS = 15 * 1000;

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

/* ─── Thread list pane ─── */

const ThreadList: React.FC<{
  refreshKey: number;
  selectedUuid: string | null;
  onSelect: (uuid: string) => void;
}> = ({ refreshKey, selectedUuid, onSelect }) => {
  const data = useLazyLoadQuery<ChatThreadsQueryType>(
    ChatThreadsQuery,
    {},
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const threads = (data?.chatThreads ?? []).filter(Boolean);
  if (threads.length === 0) {
    return (
      <div className="p-6 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>
        <p className="mono text-[10px] mb-2" style={{ letterSpacing: "0.18em" }}>
          CHAT · EMPTY
        </p>
        <p className="text-sm">No threads yet. BAs will appear here as they message in.</p>
      </div>
    );
  }
  return (
    <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
      {threads.map((t) => {
        const active = t.uuid === selectedUuid;
        return (
          <button
            key={t.uuid}
            onClick={() => onSelect(String(t.uuid))}
            className="w-full text-left px-4 py-3 flex items-center gap-3 transition"
            style={{
              background: active ? "var(--spark-surface-2)" : "transparent",
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <span
              className="spark-avatar"
              style={{
                width: 36,
                height: 36,
                fontSize: "0.8rem",
                background: t.kind === "job" ? "rgba(95,184,239,0.15)" : undefined,
              }}
            >
              {t.kind === "job"
                ? initials(String(t.jobName ?? "Job"))
                : initials(String(t.ambassadorName ?? "BA"))}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">
                  {t.ambassadorName ?? "Ambassador"}
                </p>
                <span
                  className="mono text-[9px]"
                  style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
                >
                  {fmtRelative(t.lastMessageAt)}
                </span>
              </div>
              <p
                className="text-xs truncate mt-0.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {t.kind === "job" && t.jobName ? (
                  <span style={{ color: "var(--spark-sky, #5fb8ef)" }}>
                    {t.jobName} ·{" "}
                  </span>
                ) : null}
                {t.lastMessageSenderIsAmbassador ? "" : "You: "}
                {t.lastMessagePreview ?? "No messages yet"}
              </p>
            </div>
            {t.unreadForAdmin > 0 ? (
              <span
                className="mono text-[10px] rounded-full px-2 py-0.5"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                {t.unreadForAdmin > 99 ? "99+" : t.unreadForAdmin}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

/* ─── Conversation pane ─── */

const Conversation: React.FC<{
  threadUuid: string;
  onSent: () => void;
}> = ({ threadUuid, onSent }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<ChatThreadQueryType>(
    ChatThreadQuery,
    { uuid: threadUuid },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const thread = data?.chatThread;
  const [commitSend, isSending] =
    useMutation<SendChatMessageMutationType>(SendChatMessageMutation);
  const [commitMarkRead] = useMutation<MarkChatThreadReadMutationType>(
    MarkChatThreadReadMutation,
  );
  const [composer, setComposer] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mark-read on first paint when unread > 0. The ref keeps us from
  // firing on every poll refresh.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!thread) return;
    if (markedRef.current === thread.uuid) return;
    if (thread.unreadForAdmin > 0) {
      commitMarkRead({
        variables: { input: { threadUuid: String(thread.uuid) } },
        onCompleted: () => setRefreshKey((k) => k + 1),
      });
    }
    markedRef.current = String(thread.uuid);
  }, [thread, commitMarkRead]);

  // 15s polling refresh + Visibility API gate.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => setRefreshKey((k) => k + 1), ACTIVE_THREAD_POLL_MS);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages?.length]);

  if (!thread) {
    return (
      <div className="p-6" style={{ color: "rgba(255,255,255,0.55)" }}>
        Thread not found.
      </div>
    );
  }

  const send = () => {
    const body = composer.trim();
    if (!body || isSending) return;
    commitSend({
      variables: { input: { threadUuid: String(thread.uuid), body } },
      onCompleted: (res) => {
        if (res.sendChatMessage) {
          setComposer("");
          setRefreshKey((k) => k + 1);
          onSent();
        } else {
          showAlert("Couldn't send.", "error");
        }
      },
      onError: (err) => showAlert(`Send failed: ${err.message}`, "error"),
    });
  };

  // Messages from the API are newest-first; reverse so the UI
  // renders oldest at top → newest at bottom (chat-natural order).
  const messages = [...(thread.messages ?? [])]
    .filter(Boolean)
    .reverse();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
      {/* Conversation header */}
      <div
        className="px-5 py-3"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
        >
          {thread.kind === "job" ? "JOB THREAD" : "DIRECT MESSAGE"}
        </p>
        <h3 className="font-semibold text-base mt-0.5">
          {thread.ambassadorName}
        </h3>
        {thread.kind === "job" && thread.jobName ? (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            {thread.jobName}
          </p>
        ) : null}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
            No messages yet. Send the first one 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = !m.senderIsAmbassador;
            return (
              <div
                key={String(m.uuid)}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="rounded-2xl px-4 py-2.5 max-w-[70%]"
                  style={{
                    background: mine ? "var(--spark-lime)" : "var(--spark-surface-2, rgba(255,255,255,0.05))",
                    color: mine ? "#0a0d09" : "var(--spark-text)",
                    borderBottomRightRadius: mine ? 6 : undefined,
                    borderBottomLeftRadius: mine ? undefined : 6,
                  }}
                >
                  {m.body ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {m.body}
                    </p>
                  ) : null}
                  <MessageAttachments
                    attachments={m.attachments}
                    mine={mine}
                  />
                  <p
                    className="mono text-[9px] mt-1.5"
                    style={{
                      letterSpacing: "0.12em",
                      color: mine ? "rgba(10,13,9,0.55)" : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {m.senderIsAmbassador ? m.senderName ?? "BA" : "You"} ·{" "}
                    {fmtTime(String(m.createdAt))}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div
        className="px-5 py-3 flex items-end gap-2"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          onKeyDown={(e) => {
            // Enter to send; Shift+Enter for newline. Matches Slack
            // and most chat conventions.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message — Enter to send, Shift+Enter for newline"
          rows={2}
          className="flex-1 rounded-xl px-3 py-2 text-sm leading-relaxed"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            resize: "none",
          }}
        />
        <button
          onClick={send}
          disabled={isSending || !composer.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            opacity: isSending || !composer.trim() ? 0.5 : 1,
          }}
        >
          {isSending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
};

/* ─── Page shell ─── */

const SparkChatPage: React.FC = () => {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  // Poll the thread list every 30s so new conversations + unread
  // counts stay current without manual refresh.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => setRefreshKey((k) => k + 1), THREAD_LIST_POLL_MS);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const onSent = useCallback(() => {
    // Bump the thread list so the new "last message" preview +
    // sender flag refresh after our send.
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
            >
              COMMS · CHAT
            </p>
            <h1 className="display text-3xl font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
              Chat
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              Two-way messaging with your BAs. General DMs and per-job threads in one
              place; mobile push notifies them on every reply.
            </p>
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
            }}
          >
            ✏️ New message
          </button>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-[340px_1fr] rounded-2xl overflow-hidden"
          style={{ background: "var(--spark-surface)", border: "1px solid var(--spark-border)" }}
        >
          <div style={{ borderRight: "1px solid var(--spark-border)" }}>
            <Suspense
              fallback={
                <div
                  className="p-6 mono text-[10px]"
                  style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
                >
                  LOADING THREADS…
                </div>
              }
            >
              <ThreadList
                refreshKey={refreshKey}
                selectedUuid={selectedUuid}
                onSelect={setSelectedUuid}
              />
            </Suspense>
          </div>
          <div>
            {selectedUuid ? (
              <Suspense
                fallback={
                  <div
                    className="p-6 mono text-[10px]"
                    style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
                  >
                    LOADING THREAD…
                  </div>
                }
              >
                <Conversation threadUuid={selectedUuid} onSent={onSent} />
              </Suspense>
            ) : (
              <div className="p-10 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>
                <p
                  className="mono text-[10px] mb-2"
                  style={{ letterSpacing: "0.18em" }}
                >
                  SELECT A THREAD
                </p>
                <p className="text-sm">
                  Pick a conversation on the left to read + reply.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {composerOpen ? (
        <BroadcastComposer
          onClose={() => setComposerOpen(false)}
          onSent={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
    </Layout>
  );
};

// Used by the Sidebar to prime the network cache before the page mounts.
// Cheap — fetchQuery is fire-and-forget; if it fails the page's own
// Suspense fallback covers the load.
export function prefetchChatThreads() {
  fetchQuery(environment, ChatThreadsQuery, {}).toPromise().catch(() => {});
}

export default SparkChatPage;
