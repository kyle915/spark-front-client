import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { adminRequestUrl } from "@/utils/publicHosts";
import { formatNoteBodyHtml } from "./formatNoteBodyHtml";

/**
 * Internal notes + @mention tagging for a Master Tracker row.
 *
 * v1: localStorage-backed (per-tenant), so notes survive reloads but live
 * in the browser only. Wiring to a server-side `request_notes` table +
 * mutation is tracked in REBUILD-PLAN.md — the UI is identical once the
 * backend lands; only the persistence layer changes.
 *
 * @mention: typing "@" inside the textarea pops a suggestions menu that
 * matches against RMM names + a static admin roster. Selecting a user
 * inserts "@firstname.lastname" and shows the recipient(s) in a header
 * pill so the author knows who's about to be notified.
 *
 * Assets: a "Ship asset →" mode flips the note into a structured
 * shipment request (label, recipient, tracking) for FedEx/UPS dropoffs.
 */

type Note = {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  mentions: string[];
  shipment?: {
    label: string;
    recipient: string;
    tracking?: string;
  };
};

type Mentionable = {
  id: string;
  name: string;
  email: string;
};

const STORAGE_KEY = (tenantId: string, requestUuid: string) =>
  `@spark.notes/${tenantId}/${requestUuid}`;

const loadNotes = (tenantId: string, requestUuid: string): Note[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(tenantId, requestUuid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveNotes = (
  tenantId: string,
  requestUuid: string,
  notes: Note[],
) => {
  try {
    localStorage.setItem(
      STORAGE_KEY(tenantId, requestUuid),
      JSON.stringify(notes),
    );
  } catch {
    /* quota or private mode — ignore */
  }
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const fmtAgo = (iso: string) => {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000)
      return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export const InternalNotesPanel: React.FC<{
  requestUuid: string;
  requestLabel: string;
  mentionables: Mentionable[];
}> = ({ requestUuid, requestLabel, mentionables }) => {
  const { user, tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [notes, setNotes] = useState<Note[]>(() =>
    tenantId ? loadNotes(tenantId, requestUuid) : [],
  );
  const [draft, setDraft] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [shipmentMode, setShipmentMode] = useState(false);
  const [shipLabel, setShipLabel] = useState("");
  const [shipRecipient, setShipRecipient] = useState("");

  useEffect(() => {
    if (tenantId) {
      setNotes(loadNotes(tenantId, requestUuid));
    }
  }, [tenantId, requestUuid]);

  const authorName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "You";
  const authorEmail = user?.email ?? "you@spark.app";

  const mentionMatches = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return mentionables
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mentionQuery, mentionables]);

  const onDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(v);
    // Detect "@…" suffix at the cursor
    const caret = e.target.selectionStart ?? v.length;
    const lead = v.slice(0, caret);
    const m = lead.match(/(?:^|\s)@([\w.-]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (m: Mentionable) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? draft.length;
    const before = draft.slice(0, caret).replace(/@([\w.-]*)$/, "");
    const handle = `@${m.email.split("@")[0]}`;
    const after = draft.slice(caret);
    const next = `${before}${handle} ${after}`;
    setDraft(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + handle + " ").length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const extractMentions = (body: string): string[] => {
    const out = new Set<string>();
    const re = /@([\w.-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) out.add(m[1]);
    return Array.from(out);
  };

  // Map @-handles in the draft back to recipient emails via the
  // mentionables list. The insertMention pathway uses
  // `${email.split('@')[0]}` as the visible handle, so we match the
  // local-part of each mentionable's email.
  const handlesToEmails = (handles: string[]): string[] => {
    const byHandle = new Map<string, string>();
    for (const m of mentionables) {
      const handle = (m.email || "").split("@")[0].toLowerCase();
      if (handle) byHandle.set(handle, m.email);
    }
    const out = new Set<string>();
    for (const h of handles) {
      const e = byHandle.get(h.toLowerCase());
      if (e) out.add(e);
    }
    return Array.from(out);
  };

  const fireMentionEmails = async (
    handles: string[],
    body: string,
  ): Promise<{ sent: number; failed: string[] }> => {
    const emails = handlesToEmails(handles);
    if (emails.length === 0) return { sent: 0, failed: [] };
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
        },
        body: JSON.stringify({
          query: `
            mutation NotifyNoteMention($input: NotifyNoteMentionInput!) {
              notifyNoteMention(input: $input) {
                success
                message
                sentCount
                failedEmails
              }
            }
          `,
          variables: {
            input: {
              requestId: requestUuid,
              noteBody: body,
              recipientEmails: emails,
              requestUrl: adminRequestUrl(requestUuid),
            },
          },
        }),
      });
      const json = await res.json();
      const r = json?.data?.notifyNoteMention;
      if (json.errors?.length || !r) {
        return { sent: 0, failed: emails };
      }
      return {
        sent: r.sentCount ?? 0,
        failed: r.failedEmails ?? [],
      };
    } catch {
      return { sent: 0, failed: emails };
    }
  };

  const submitNote = async () => {
    if (!tenantId) return;
    if (!draft.trim() && !shipmentMode) return;
    if (shipmentMode && !shipLabel.trim()) {
      showAlert("Add an asset label before shipping.", "warning");
      return;
    }
    const body = draft.trim() || (shipmentMode ? "Shipped asset." : "");
    const handles = extractMentions(draft);
    const note: Note = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body,
      authorName,
      authorEmail,
      createdAt: new Date().toISOString(),
      mentions: handles,
      shipment: shipmentMode
        ? {
            label: shipLabel.trim(),
            recipient: shipRecipient.trim() || requestLabel,
          }
        : undefined,
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(tenantId, requestUuid, next);
    setDraft("");
    setShipLabel("");
    setShipRecipient("");
    setShipmentMode(false);

    // Fire the email notification mutation in the background. We
    // optimistically render the note immediately and surface a
    // per-status toast once the fanout returns.
    if (handles.length > 0) {
      const { sent, failed } = await fireMentionEmails(handles, body);
      if (sent > 0 && failed.length === 0) {
        showAlert(
          `Note added · emailed ${sent} teammate${sent === 1 ? "" : "s"}.`,
          "success",
        );
      } else if (sent > 0) {
        showAlert(
          `Note added · emailed ${sent}, ${failed.length} bounced.`,
          "warning",
        );
      } else {
        showAlert(
          `Note saved locally, but the @-mention email didn't go out. Check that the tagged user has a real email on file.`,
          "warning",
        );
      }
    } else {
      showAlert("Note added.", "success");
    }
  };

  const removeNote = (id: string) => {
    if (!tenantId) return;
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(tenantId, requestUuid, next);
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    borderRadius: 10,
    padding: "0.55rem 0.8rem",
    color: "var(--spark-text)",
    fontSize: "0.85rem",
    outline: "none",
    width: "100%",
    fontFamily: "Space Grotesk, sans-serif",
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(var(--spark-ink-rgb),0.02)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          INTERNAL · {notes.length} NOTE{notes.length === 1 ? "" : "S"}
        </p>
        <button
          onClick={() => setShipmentMode((v) => !v)}
          className="mono text-[10px] transition"
          style={{
            letterSpacing: "0.14em",
            color: shipmentMode
              ? "var(--spark-lime)"
              : "rgba(var(--spark-ink-rgb),0.55)",
          }}
        >
          {shipmentMode ? "× CANCEL SHIPMENT" : "SHIP ASSET →"}
        </button>
      </div>

      {/* Composer */}
      <div className="relative">
        {shipmentMode && (
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            <input
              value={shipLabel}
              onChange={(e) => setShipLabel(e.target.value)}
              placeholder="Asset label · e.g. Cooler + 2 cases LD"
              style={inputStyle}
            />
            <input
              value={shipRecipient}
              onChange={(e) => setShipRecipient(e.target.value)}
              placeholder="Recipient · BA name or venue contact"
              style={inputStyle}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={onDraftChange}
          placeholder={
            shipmentMode
              ? "Notes on the shipment (optional). Use @ to tag teammates."
              : "Add an internal note. Use @ to tag a teammate."
          }
          rows={2}
          className="rounded-xl text-sm"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            outline: "none",
            width: "100%",
            padding: "0.65rem 0.85rem",
            resize: "vertical",
            fontFamily: "Space Grotesk, sans-serif",
          }}
        />
        {mentionOpen && mentionMatches.length > 0 && (
          <div
            className="absolute z-10 left-0 right-0 mt-1 rounded-xl overflow-hidden"
            style={{
              background: "var(--spark-surface)",
              border: "1px solid var(--spark-border)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            }}
          >
            {mentionMatches.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(m)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                style={{
                  background: "transparent",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(var(--spark-accent-rgb),0.06)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span
                  className="spark-avatar"
                  style={{ width: 24, height: 24, fontSize: "0.65rem" }}
                >
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    @{m.email.split("@")[0]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={submitNote}
          disabled={!draft.trim() && !shipmentMode}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            boxShadow:
              draft.trim() || shipmentMode
                ? "0 0 12px rgba(var(--spark-accent-rgb),0.35)"
                : "none",
            opacity: draft.trim() || shipmentMode ? 1 : 0.4,
          }}
        >
          {shipmentMode ? "Log shipment" : "Add note"}
        </button>
      </div>

      {/* Notes list */}
      {notes.length > 0 && (
        <ul className="mt-3 space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{
                background: "rgba(var(--spark-ink-rgb),0.02)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <span
                className="spark-avatar"
                style={{ width: 28, height: 28, fontSize: "0.7rem" }}
              >
                {initials(n.authorName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{n.authorName}</p>
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    {fmtAgo(n.createdAt)}
                  </span>
                  {n.shipment && (
                    <span className="chip chip-lime">SHIPMENT</span>
                  )}
                </div>
                {n.shipment && (
                  <div
                    className="mt-2 p-2 rounded-lg"
                    style={{
                      background: "rgba(var(--spark-accent-rgb),0.06)",
                      border: "1px solid rgba(var(--spark-accent-rgb),0.25)",
                    }}
                  >
                    <p className="text-xs font-semibold">{n.shipment.label}</p>
                    <p
                      className="mono text-[10px] mt-0.5"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      → {n.shipment.recipient.toUpperCase()}
                    </p>
                  </div>
                )}
                {n.body && (
                  <p
                    className="text-sm mt-1 leading-relaxed"
                    style={{ color: "var(--spark-text)" }}
                    dangerouslySetInnerHTML={{
                      __html: formatNoteBodyHtml(n.body),
                    }}
                  />
                )}
                {n.mentions.length > 0 && (
                  <p
                    className="mono text-[10px] mt-2"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    NOTIFIED · @{n.mentions.join(", @")}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeNote(n.id)}
                className="text-xs"
                style={{ color: "var(--spark-text-meta)" }}
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InternalNotesPanel;
