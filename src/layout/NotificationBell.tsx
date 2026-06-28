import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import useSparkRole from "@/hooks/useSparkRole";

/**
 * Admin notification center — a header bell that surfaces shift events the
 * Ignite team needs to catch: pending shift-extension requests (with inline
 * Approve / Decline), plus the recent feed of running-late / can't-make-it
 * alerts. Backed by the Spark schema (myNotifications / pendingShiftExtensions
 * / resolveShiftExtension / markNotificationsRead). Admin-only.
 *
 * Uses the raw postGql pattern (same as DeleteJobModal) — no Relay codegen.
 */

async function postGql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

type PendingExtension = {
  uuid: string;
  baName: string;
  venue: string;
  minutesRequested: number;
  reason: string;
  createdAt: string;
};
type FeedItem = {
  uuid: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  read: boolean;
};

const UNREAD_Q = `query { myUnreadNotificationCount }`;
const FEED_Q = `query {
  pendingShiftExtensions(limit: 50) { uuid baName venue minutesRequested reason createdAt }
  myNotifications(limit: 30) { uuid title body kind createdAt read }
}`;
const MARK_READ_M = `mutation { markNotificationsRead }`;
const RESOLVE_M = `mutation Resolve($input: ResolveShiftExtensionInput!) {
  resolveShiftExtension(input: $input) { success message extension { id status approvedMinutes } }
}`;

const ago = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const kindEmoji = (k: string) => {
  if (k === "extension_request") return "⏱";
  if (k === "shift_status") return "⚠️";
  if (k === "extension_decision") return "✅";
  return "🔔";
};

export default function NotificationBell() {
  const { isAdmin } = useSparkRole();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<PendingExtension[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Which pending row is being confirmed (+ which decision) and the required
  // reason note. Approve/Decline first reveal the note field — you can't
  // resolve without writing a reason (it's sent to the BA).
  const [confirm, setConfirm] = useState<
    { uuid: string; decision: "approve" | "decline" } | null
  >(null);
  const [reasonText, setReasonText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const d = await postGql<{ myUnreadNotificationCount: number }>(UNREAD_Q);
      setUnread(d.myUnreadNotificationCount ?? 0);
    } catch {
      /* silent — a transient failure shouldn't break the header */
    }
  }, []);

  // Poll the unread badge while mounted (admins only).
  useEffect(() => {
    if (!isAdmin) return;
    refreshCount();
    const t = setInterval(refreshCount, 30000);
    return () => clearInterval(t);
  }, [isAdmin, refreshCount]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await postGql<{
        pendingShiftExtensions: PendingExtension[];
        myNotifications: FeedItem[];
      }>(FEED_Q);
      setPending(d.pendingShiftExtensions ?? []);
      setFeed(d.myNotifications ?? []);
      // Opening the panel clears the unread badge.
      try {
        await postGql(MARK_READ_M);
        setUnread(0);
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const resolve = async (
    uuid: string,
    decision: "approve" | "decline",
    reason: string,
  ) => {
    if (busy) return;
    if (!reason.trim()) {
      setErr("Add a quick note for the BA first.");
      return;
    }
    setBusy(uuid);
    setErr(null);
    try {
      const d = await postGql<{
        resolveShiftExtension: { success: boolean; message: string };
      }>(RESOLVE_M, {
        input: { extensionUuid: uuid, decision, reason: reason.trim() },
      });
      if (d.resolveShiftExtension?.success) {
        setPending((p) => p.filter((x) => x.uuid !== uuid));
        setConfirm(null);
        setReasonText("");
      } else {
        setErr(d.resolveShiftExtension?.message || "Couldn't update that.");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative w-9 h-9 rounded-full border border-base-300 flex items-center justify-center text-base-content/70 hover:text-primary hover:border-primary transition"
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--spark-orange, #ef5a2a)", color: "#0a0d09" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-2xl overflow-hidden z-50"
          style={{
            background: "var(--spark-surface, #11140e)",
            border: "1px solid var(--spark-border, #1f2418)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <span
              className="mono text-[10px]"
              style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}
            >
              NOTIFICATIONS
            </span>
            <button
              onClick={load}
              className="text-[11px] text-base-content/50 hover:text-primary"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {err && (
              <p className="px-4 py-3 text-[11px]" style={{ color: "var(--spark-orange)" }}>
                {err}
              </p>
            )}

            {/* Action needed — pending extension requests */}
            {pending.length > 0 && (
              <div className="px-3 pt-3">
                <p className="label-mini px-1 mb-1">ACTION NEEDED</p>
                {pending.map((p) => (
                  <div
                    key={p.uuid}
                    className="p-3 mb-2 rounded-xl"
                    style={{
                      background: "var(--spark-bg, #0a0d09)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    <p className="text-sm font-semibold">
                      ⏱ {p.baName} · +{p.minutesRequested} min
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {p.venue} · {ago(p.createdAt)}
                    </p>
                    {p.reason ? (
                      <p className="text-xs mt-1 italic" style={{ color: "rgba(255,255,255,0.7)" }}>
                        “{p.reason}”
                      </p>
                    ) : null}
                    {confirm?.uuid === p.uuid ? (
                      <div className="mt-2">
                        <textarea
                          autoFocus
                          rows={2}
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                          placeholder={
                            confirm.decision === "approve"
                              ? "Note to the BA (required) — e.g. Approved, finish the demo."
                              : "Note to the BA (required) — e.g. Can't extend, store closes at 8."
                          }
                          className="w-full text-xs rounded-lg p-2"
                          style={{
                            background: "var(--spark-surface, #11140e)",
                            border: "1px solid var(--spark-border)",
                            color: "var(--spark-text)",
                          }}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            disabled={busy === p.uuid || !reasonText.trim()}
                            onClick={() =>
                              resolve(p.uuid, confirm.decision, reasonText)
                            }
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                            style={
                              confirm.decision === "approve"
                                ? { background: "var(--spark-lime)", color: "#0a0d09" }
                                : { background: "var(--spark-orange)", color: "#0a0d09" }
                            }
                          >
                            {busy === p.uuid
                              ? "…"
                              : confirm.decision === "approve"
                                ? `Confirm approve +${p.minutesRequested}m`
                                : "Confirm decline"}
                          </button>
                          <button
                            disabled={busy === p.uuid}
                            onClick={() => {
                              setConfirm(null);
                              setReasonText("");
                              setErr(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{
                              background: "transparent",
                              color: "rgba(255,255,255,0.6)",
                              border: "1px solid var(--spark-border)",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            setConfirm({ uuid: p.uuid, decision: "approve" });
                            setReasonText("");
                            setErr(null);
                          }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
                        >
                          {`Approve +${p.minutesRequested}m`}
                        </button>
                        <button
                          onClick={() => {
                            setConfirm({ uuid: p.uuid, decision: "decline" });
                            setReasonText("");
                            setErr(null);
                          }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{
                            background: "transparent",
                            color: "var(--spark-orange)",
                            border: "1px solid var(--spark-border)",
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Recent feed */}
            <div className="px-3 py-3">
              {pending.length > 0 && <p className="label-mini px-1 mb-1">RECENT</p>}
              {loading ? (
                <p className="px-1 py-6 text-center text-xs text-base-content/50">Loading…</p>
              ) : feed.length === 0 && pending.length === 0 ? (
                <p className="px-1 py-8 text-center text-xs text-base-content/50">
                  You're all caught up.
                </p>
              ) : (
                feed.map((n) => (
                  <div
                    key={n.uuid}
                    className="flex gap-2.5 px-1 py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span className="text-base leading-none mt-0.5">{kindEmoji(n.kind)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{n.title}</p>
                      {n.body ? (
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                          {n.body}
                        </p>
                      ) : null}
                      <p className="text-[10px] mt-0.5 text-base-content/40">{ago(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
