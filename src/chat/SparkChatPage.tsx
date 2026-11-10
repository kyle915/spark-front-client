import { Suspense, useCallback, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useSearchParams } from "react-router";
import { fetchQuery } from "relay-runtime";
import Layout from "@/layout/Layout";
import environment from "@/api/relay/environment";
import { ChatThreadsQuery } from "@/api/queries/ChatThreadsQuery";
import type { ChatThreadsQuery as ChatThreadsQueryType } from "@api/queries/__generated__/ChatThreadsQuery.graphql";
import { ArchiveChatThreadMutation } from "@/api/mutations/ArchiveChatThreadMutation";
import type { ArchiveChatThreadMutation as ArchiveChatThreadMutationType } from "@api/mutations/__generated__/ArchiveChatThreadMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import BroadcastComposer from "./BroadcastComposer";
import ChatConversation from "./ChatConversation";

/**
 * Admin-side chat page — split layout, thread list on the left,
 * conversation pane on the right. Mirrors the mobile inbox shape
 * but with the admin-side unread counts (unreadForAdmin).
 *
 * The conversation pane is the shared <ChatConversation> component,
 * reused as-is inside the BA profile modal's "DM" flow so a thread
 * looks + behaves identically wherever it's opened.
 *
 * Polling: thread list refreshes every 30s while the page is open;
 * the active conversation refreshes every 15s. Both stop when the
 * tab is hidden (Page Visibility API) — push notifications still
 * deliver while the admin is elsewhere on the site, and the
 * sidebar badge picks up the count on the next 60s tick.
 */

const THREAD_LIST_POLL_MS = 30 * 1000;

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
  onDeleted: (uuid: string) => void;
}> = ({ refreshKey, selectedUuid, onSelect, onDeleted }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitArchive, isArchiving] =
    useMutation<ArchiveChatThreadMutationType>(ArchiveChatThreadMutation);
  const data = useLazyLoadQuery<ChatThreadsQueryType>(
    ChatThreadsQuery,
    {},
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const threads = (data?.chatThreads ?? []).filter(Boolean);

  const onDelete = (uuid: string, name: string) => {
    if (
      !window.confirm(
        `Delete the chat with ${name}? It's removed from your list but recoverable — messages aren't purged.`,
      )
    )
      return;
    commitArchive({
      variables: { input: { threadUuid: uuid, archived: true } },
      onCompleted: (res) => {
        if (res.archiveChatThread) {
          showAlert("Chat deleted.", "success");
          onDeleted(uuid);
        } else {
          showAlert("Couldn't delete chat.", "error");
        }
      },
      onError: (err) => showAlert(`Delete failed: ${err.message}`, "error"),
    });
  };
  if (threads.length === 0) {
    return (
      <div className="p-6 text-center" style={{ color: "var(--spark-text-meta)" }}>
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
        const name = String(t.ambassadorName ?? "this BA");
        return (
          <div
            key={t.uuid}
            className="group w-full px-4 py-3 flex items-center gap-3 transition"
            style={{
              background: active ? "var(--spark-surface-2)" : "transparent",
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <button
              onClick={() => onSelect(String(t.uuid))}
              className="flex-1 min-w-0 text-left flex items-center gap-3"
              style={{ background: "transparent", border: "none" }}
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
                    style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
                  >
                    {fmtRelative(t.lastMessageAt)}
                  </span>
                </div>
                <p
                  className="text-xs truncate mt-0.5"
                  style={{ color: "var(--spark-text-meta)" }}
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
            </button>
            {t.unreadForAdmin > 0 ? (
              <span
                className="mono text-[10px] rounded-full px-2 py-0.5 shrink-0"
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
            {/* Trash / delete (soft delete) — appears on row hover. */}
            <button
              onClick={() => onDelete(String(t.uuid), name)}
              disabled={isArchiving}
              title="Delete chat"
              aria-label={`Delete chat with ${name}`}
              className="shrink-0 rounded-lg px-2 py-1 text-xs transition opacity-0 group-hover:opacity-100 focus:opacity-100"
              style={{
                background: "transparent",
                color: "rgba(255,90,42,0.95)",
                border: "1px solid rgba(255,90,42,0.4)",
              }}
            >
              🗑
            </button>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Page shell ─── */

const SparkChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-link support: `/chat?thread=<uuid>` pre-selects that conversation
  // (used when the admin opens a DM from a job applicant). Seed the
  // selection once from the URL, then strip the param so it doesn't stick.
  const [selectedUuid, setSelectedUuid] = useState<string | null>(
    () => searchParams.get("thread"),
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (searchParams.has("thread")) {
      const next = new URLSearchParams(searchParams);
      next.delete("thread");
      setSearchParams(next, { replace: true });
    }
    // Only on mount — we just want to clear the seed param once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
            >
              COMMS · CHAT
            </p>
            <h1 className="display text-3xl font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
              Chat
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--spark-text-meta)" }}>
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
                  style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
                >
                  LOADING THREADS…
                </div>
              }
            >
              <ThreadList
                refreshKey={refreshKey}
                selectedUuid={selectedUuid}
                onSelect={setSelectedUuid}
                onDeleted={(uuid) => {
                  // Clear the conversation pane if the open thread was the
                  // one deleted, then refetch so the row drops out.
                  setSelectedUuid((cur) => (cur === uuid ? null : cur));
                  setRefreshKey((k) => k + 1);
                }}
              />
            </Suspense>
          </div>
          <div>
            {selectedUuid ? (
              <Suspense
                fallback={
                  <div
                    className="p-6 mono text-[10px]"
                    style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
                  >
                    LOADING THREAD…
                  </div>
                }
              >
                <ChatConversation threadUuid={selectedUuid} onSent={onSent} />
              </Suspense>
            ) : (
              <div className="p-10 text-center" style={{ color: "var(--spark-text-meta)" }}>
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
