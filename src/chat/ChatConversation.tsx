import { useEffect, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { ChatThreadQuery } from "@/api/queries/ChatThreadQuery";
import type { ChatThreadQuery as ChatThreadQueryType } from "@api/queries/__generated__/ChatThreadQuery.graphql";
import { ChatThreadDeltaQuery } from "@/api/queries/ChatThreadDeltaQuery";
import type { ChatThreadDeltaQuery as ChatThreadDeltaQueryType } from "@api/queries/__generated__/ChatThreadDeltaQuery.graphql";
import { SendChatMessageMutation } from "@/api/mutations/SendChatMessageMutation";
import type { SendChatMessageMutation as SendChatMessageMutationType } from "@api/mutations/__generated__/SendChatMessageMutation.graphql";
import { MarkChatThreadReadMutation } from "@/api/mutations/MarkChatThreadReadMutation";
import type { MarkChatThreadReadMutation as MarkChatThreadReadMutationType } from "@api/mutations/__generated__/MarkChatThreadReadMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import {
  CHAT_ATTACHMENT_ACCEPT,
  humanSize,
  toAttachmentInputs,
  uploadChatAttachment,
  type PendingAttachment,
} from "./chatAttachments";

/**
 * Shared two-way conversation pane for a single ChatThread.
 *
 * This is the message-history + reply-box used both on the admin Chat
 * page (SparkChatPage) and inline inside the BA profile modal's "DM"
 * flow, so a thread looks + behaves identically wherever it's opened:
 * inbound/outbound bubbles, oldest→newest with newest at the bottom,
 * attachment rendering, 15s polling (Visibility-gated), mark-as-read on
 * open, and a composer that sends via sendChatMessage (delivers in-app +
 * push).
 *
 * It loads its own data from ChatThreadQuery given a threadUuid — the
 * caller only needs to know the uuid (e.g. from openChatThread). An
 * empty thread renders the "send the first one" prompt and works the
 * same as a populated one.
 *
 * Live refresh uses ChatThreadDeltaQuery + afterUuid so the 15s poll
 * does not remount the thread via fetchKey.
 */

const ACTIVE_THREAD_POLL_MS = 15 * 1000;
const CHAT_PAGE = 200;

type ThreadMessages = NonNullable<
  ChatThreadQueryType["response"]["chatThread"]
>["messages"];
type ThreadMessage = NonNullable<ThreadMessages[number]>;

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
              background: mine ? "rgba(var(--spark-bg-rgb),0.12)" : "rgba(var(--spark-ink-rgb),0.07)",
              color: mine ? "var(--spark-on-accent)" : "var(--spark-text)",
              border: mine
                ? "1px solid rgba(var(--spark-bg-rgb),0.2)"
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

/* ─── Conversation pane ─── */

const ChatConversation: React.FC<{
  threadUuid: string;
  /** Called after a successful send — e.g. to refresh a thread list. */
  onSent?: () => void;
  /**
   * Whether to render the thread header (kind + ambassador name). The
   * profile modal already shows the BA's name, so it hides this; the
   * full Chat page shows it. Defaults to true.
   */
  showHeader?: boolean;
  /** CSS height for the pane. Defaults to the full Chat page height. */
  height?: string;
}> = ({
  threadUuid,
  onSent,
  showHeader = true,
  height = "calc(100vh - 180px)",
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<ChatThreadQueryType>(
    ChatThreadQuery,
    { uuid: threadUuid, first: CHAT_PAGE, beforeUuid: null },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const thread = data?.chatThread;
  const [older, setOlder] = useState<ThreadMessages>([]);
  const [newer, setNewer] = useState<ThreadMessage[]>([]);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderHasMore, setOlderHasMore] = useState(true);
  const newestUuidRef = useRef<string | null>(null);

  useEffect(() => {
    setOlder([]);
    setNewer([]);
    setOlderHasMore(true);
    newestUuidRef.current = null;
  }, [threadUuid]);

  // Full reload (send / mark-read) already includes latest — drop deltas.
  useEffect(() => {
    setNewer([]);
  }, [refreshKey]);

  const [commitSend, isSending] =
    useMutation<SendChatMessageMutationType>(SendChatMessageMutation);
  const [commitMarkRead] = useMutation<MarkChatThreadReadMutationType>(
    MarkChatThreadReadMutation,
  );
  const [composer, setComposer] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
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

  // Page is newest-first; newer deltas are ascending (afterUuid).
  useEffect(() => {
    const pageNewest = thread?.messages?.[0]?.uuid
      ? String(thread.messages[0].uuid)
      : null;
    const deltaNewest = newer.length
      ? String(newer[newer.length - 1]!.uuid)
      : null;
    newestUuidRef.current = deltaNewest ?? pageNewest;
  }, [thread?.messages, newer]);

  // 15s delta poll + Visibility API gate — no fetchKey remount.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const poll = async () => {
      const afterUuid = newestUuidRef.current;
      if (!afterUuid || cancelled) return;
      try {
        const extra = await fetchQuery<ChatThreadDeltaQueryType>(
          environment,
          ChatThreadDeltaQuery,
          { uuid: threadUuid, first: 50, afterUuid },
        ).toPromise();
        if (cancelled) return;
        const incoming = (extra?.chatThread?.messages ?? []).filter(
          (m): m is ThreadMessage => Boolean(m),
        );
        if (incoming.length === 0) return;
        setNewer((prev) => {
          const have = new Set(prev.map((m) => String(m.uuid)));
          const add = incoming.filter((m) => !have.has(String(m.uuid)));
          return add.length ? [...prev, ...add] : prev;
        });
      } catch {
        // Transient poll failure — next tick retries.
      }
    };

    const start = () => {
      if (id) return;
      id = setInterval(() => {
        void poll();
      }, ACTIVE_THREAD_POLL_MS);
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
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [threadUuid]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages?.length, newer.length]);

  if (!thread) {
    return (
      <div className="p-6" style={{ color: "var(--spark-text-meta)" }}>
        Thread not found.
      </div>
    );
  }

  const onPickFiles = async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        const att = await uploadChatAttachment(file, String(thread.uuid));
        setAttachments((prev) => [...prev, att]);
      } catch (e) {
        showAlert(
          `Couldn't attach ${file.name}: ${(e as Error).message}`,
          "error",
        );
      }
    }
    setUploading(false);
  };

  const removeAttachment = (localId: string) =>
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));

  const send = () => {
    const body = composer.trim();
    // Body is optional when at least one attachment is present (send a
    // photo/PDF with no caption) — mirrors the server + broadcast rule.
    if ((!body && attachments.length === 0) || isSending || uploading) return;
    commitSend({
      variables: {
        input: {
          threadUuid: String(thread.uuid),
          body: body || null,
          attachments: attachments.length
            ? toAttachmentInputs(attachments)
            : null,
        },
      },
      onCompleted: (res) => {
        if (res.sendChatMessage) {
          setComposer("");
          setAttachments([]);
          setRefreshKey((k) => k + 1);
          onSent?.();
        } else {
          showAlert("Couldn't send.", "error");
        }
      },
      onError: (err) => showAlert(`Send failed: ${err.message}`, "error"),
    });
  };

  // Page + older pages are newest-first; reverse for chat order, then
  // append ascending delta messages (newer than the page's newest).
  const page = thread.messages ?? [];
  const pageUuids = new Set(
    page.map((m) => m?.uuid).filter((u): u is string => Boolean(u)),
  );
  const olderUnique = older.filter((m) => m && !pageUuids.has(m.uuid));
  const newerUnique = newer.filter((m) => m && !pageUuids.has(m.uuid));
  const messages = [
    ...[...olderUnique, ...page].filter(Boolean).reverse(),
    ...newerUnique,
  ];
  const oldestUuid = messages[0]?.uuid;
  const canLoadOlder =
    olderHasMore && (page.length >= CHAT_PAGE || older.length >= CHAT_PAGE);

  const loadOlder = async () => {
    if (!oldestUuid || olderBusy) return;
    setOlderBusy(true);
    try {
      const extra = await fetchQuery<ChatThreadQueryType>(
        environment,
        ChatThreadQuery,
        { uuid: threadUuid, first: CHAT_PAGE, beforeUuid: oldestUuid },
      ).toPromise();
      const next = extra?.chatThread?.messages ?? [];
      if (next.length === 0) {
        setOlderHasMore(false);
        return;
      }
      setOlder((prev) => {
        const have = new Set(prev.map((m) => m.uuid));
        const add = next.filter((m) => m && !have.has(m.uuid));
        return add.length ? [...prev, ...add] : prev;
      });
      if (next.length < CHAT_PAGE) setOlderHasMore(false);
    } finally {
      setOlderBusy(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Conversation header */}
      {showHeader ? (
        <div
          className="px-5 py-3"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
          >
            {thread.kind === "job" ? "JOB THREAD" : "DIRECT MESSAGE"}
          </p>
          <h3 className="font-semibold text-base mt-0.5">
            {thread.ambassadorName}
          </h3>
          {thread.kind === "job" && thread.jobName ? (
            <p className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
              {thread.jobName}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {canLoadOlder ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={olderBusy}
              className="text-xs underline"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {olderBusy ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--spark-text-meta)" }}>
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
                    background: mine ? "var(--spark-lime)" : "var(--spark-surface-2, rgba(var(--spark-ink-rgb),0.05))",
                    color: mine ? "var(--spark-on-accent)" : "var(--spark-text)",
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
                      color: mine ? "rgba(var(--spark-bg-rgb),0.55)" : "rgba(var(--spark-ink-rgb),0.45)",
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
        className="px-5 py-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        {/* Pending attachment chips */}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a) => (
              <span
                key={a.localId}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                style={{
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {a.kind === "image" && a.previewUrl ? (
                  <img
                    src={a.previewUrl}
                    alt={a.originalFilename}
                    style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 4 }}
                  />
                ) : (
                  <span>📎</span>
                )}
                <span className="truncate" style={{ maxWidth: 160 }}>
                  {a.originalFilename}
                </span>
                {a.byteSize ? (
                  <span style={{ color: "var(--spark-text-meta)" }}>
                    {humanSize(a.byteSize)}
                  </span>
                ) : null}
                <button
                  onClick={() => removeAttachment(a.localId)}
                  style={{ color: "var(--spark-text-secondary)" }}
                  aria-label="Remove attachment"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          {/* Attach image / PDF */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={CHAT_ATTACHMENT_ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const picked = Array.from(e.target.files);
                e.target.value = "";
                void onPickFiles(picked);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || isSending}
            title="Attach image or PDF"
            aria-label="Attach image or PDF"
            className="rounded-xl text-sm font-semibold transition shrink-0"
            style={{
              width: 42,
              height: 42,
              background: "transparent",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              opacity: uploading || isSending ? 0.5 : 1,
            }}
          >
            {uploading ? "…" : "📎"}
          </button>

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
            disabled={
              isSending ||
              uploading ||
              (!composer.trim() && attachments.length === 0)
            }
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              opacity:
                isSending ||
                uploading ||
                (!composer.trim() && attachments.length === 0)
                  ? 0.5
                  : 1,
            }}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatConversation;
