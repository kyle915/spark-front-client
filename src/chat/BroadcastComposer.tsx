import { Suspense, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { ChatRecipientsQuery } from "@/api/queries/ChatRecipientsQuery";
import type { ChatRecipientsQuery as ChatRecipientsQueryType } from "@api/queries/__generated__/ChatRecipientsQuery.graphql";
import { BroadcastChatMessageMutation } from "@/api/mutations/BroadcastChatMessageMutation";
import type { BroadcastChatMessageMutation as BroadcastChatMessageMutationType } from "@api/mutations/__generated__/BroadcastChatMessageMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import {
  CHAT_ATTACHMENT_ACCEPT,
  humanSize,
  toAttachmentInputs,
  uploadChatAttachment,
  type PendingAttachment,
} from "./chatAttachments";

/**
 * "New message / Group message" composer.
 *
 * Multi-select of the active tenant's BAs AND ambassador groups, a
 * message body, an image/PDF attach control with chips + remove, and a
 * Send that calls broadcastChatMessage. Single-recipient send is just a
 * broadcast of one. Everything is tenant-scoped: the recipient lists are
 * loaded with filters.tenantId and the broadcast carries tenantId, so it
 * can only ever reach this brand's BAs.
 */

const RecipientPicker: React.FC<{
  tenantId: string;
  selectedBAs: Set<string>;
  selectedGroups: Set<string>;
  onToggleBA: (uuid: string) => void;
  onToggleGroup: (uuid: string) => void;
}> = ({
  tenantId,
  selectedBAs,
  selectedGroups,
  onToggleBA,
  onToggleGroup,
}) => {
  const [search, setSearch] = useState("");
  // chatRecipientAmbassadors is tenant-scoped by BA event history (the
  // same reachability rule the broadcast enforces), so the picker lists
  // exactly the BAs a broadcast can reach — fixing "No ambassadors
  // found". Groups stay scoped via filters.tenantId.
  const data = useLazyLoadQuery<ChatRecipientsQueryType>(
    ChatRecipientsQuery,
    {
      tenantId,
      groupFilters: {},
    },
    { fetchPolicy: "store-and-network" },
  );

  const groups = (data?.ambassadorGroups?.edges ?? [])
    .map((e) => e?.node)
    .filter(Boolean) as NonNullable<
    NonNullable<ChatRecipientsQueryType["response"]["ambassadorGroups"]>["edges"][number]
  >["node"][];

  const bas = (data?.chatRecipientAmbassadors ?? []).filter(
    Boolean,
  ) as NonNullable<
    ChatRecipientsQueryType["response"]["chatRecipientAmbassadors"][number]
  >[];

  const q = search.trim().toLowerCase();
  const filteredBAs = q
    ? bas.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.email ?? "").toLowerCase().includes(q),
      )
    : bas;
  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search BAs or groups…"
        className="w-full rounded-lg px-3 py-2 text-sm mb-3"
        style={{
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      />
      <div
        className="overflow-y-auto rounded-lg"
        style={{
          maxHeight: 240,
          border: "1px solid var(--spark-border)",
        }}
      >
        {filteredGroups.length > 0 ? (
          <div>
            <p
              className="mono text-[9px] px-3 pt-2 pb-1"
              style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
            >
              GROUPS
            </p>
            {filteredGroups.map((g) => {
              const checked = selectedGroups.has(String(g.uuid));
              const count = (g.members ?? []).length;
              return (
                <label
                  key={g.uuid}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm"
                  style={{ background: checked ? "rgba(242,243,238,0.08)" : undefined }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleGroup(String(g.uuid))}
                  />
                  <span className="flex-1">👥 {g.name}</span>
                  <span
                    className="mono text-[9px]"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    {count} {count === 1 ? "BA" : "BAs"}
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
        <p
          className="mono text-[9px] px-3 pt-2 pb-1"
          style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
        >
          AMBASSADORS
        </p>
        {filteredBAs.length === 0 ? (
          <p className="px-3 py-3 text-sm" style={{ color: "var(--spark-text-meta)" }}>
            No ambassadors found.
          </p>
        ) : (
          filteredBAs.map((b) => {
            const checked = selectedBAs.has(String(b.uuid));
            return (
              <label
                key={b.uuid}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm"
                style={{ background: checked ? "rgba(242,243,238,0.08)" : undefined }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleBA(String(b.uuid))}
                />
                <span className="flex-1">{b.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};

const BroadcastComposer: React.FC<{
  onClose: () => void;
  onSent: () => void;
}> = ({ onClose, onSent }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitBroadcast, isSending] =
    useMutation<BroadcastChatMessageMutationType>(BroadcastChatMessageMutation);

  const [selectedBAs, setSelectedBAs] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const toggle = (set: Set<string>, uuid: string) => {
    const next = new Set(set);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    return next;
  };

  const onPickFiles = async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        const att = await uploadChatAttachment(file, "broadcast");
        setAttachments((prev) => [...prev, att]);
      } catch (e) {
        showAlert(`Couldn't attach ${file.name}: ${(e as Error).message}`, "error");
      }
    }
    setUploading(false);
  };

  const removeAttachment = (localId: string) =>
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));

  const totalRecipients = selectedBAs.size + selectedGroups.size;
  const canSend =
    !isSending &&
    !uploading &&
    totalRecipients > 0 &&
    (body.trim().length > 0 || attachments.length > 0);

  const send = () => {
    if (!canSend) return;
    commitBroadcast({
      variables: {
        input: {
          body: body.trim() || null,
          ambassadorUuids: Array.from(selectedBAs),
          groupUuids: Array.from(selectedGroups),
          tenantId: tenantId ?? null,
          attachments: attachments.length ? toAttachmentInputs(attachments) : null,
        },
      },
      onCompleted: (res) => {
        const r = res.broadcastChatMessage;
        if (r?.success) {
          showAlert(r.message || `Sent to ${r.recipientCount} BA(s).`, "success");
          onSent();
          onClose();
        } else {
          showAlert(r?.message || "Couldn't send broadcast.", "error");
        }
      },
      onError: (err) => showAlert(`Broadcast failed: ${err.message}`, "error"),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-lg p-5"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
            >
              COMMS · NEW MESSAGE
            </p>
            <h3 className="display text-xl font-bold mt-0.5">New / group message</h3>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded-lg"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            ✕
          </button>
        </div>

        {!tenantId ? (
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            Select a tenant first — broadcasts are scoped to the brand you're
            acting in.
          </p>
        ) : (
          <>
            <p
              className="mono text-[9px] mb-1.5"
              style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
            >
              RECIPIENTS {totalRecipients > 0 ? `· ${totalRecipients} SELECTED` : ""}
            </p>
            <Suspense
              fallback={
                <div
                  className="p-4 mono text-[10px]"
                  style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
                >
                  LOADING RECIPIENTS…
                </div>
              }
            >
              <RecipientPicker
                tenantId={tenantId}
                selectedBAs={selectedBAs}
                selectedGroups={selectedGroups}
                onToggleBA={(u) => setSelectedBAs((s) => toggle(s, u))}
                onToggleGroup={(u) => setSelectedGroups((s) => toggle(s, u))}
              />
            </Suspense>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm leading-relaxed mt-3"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                resize: "none",
              }}
            />

            {/* Attachment chips */}
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
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

            <div className="flex items-center justify-between mt-4 gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                {uploading ? "Uploading…" : "📎 Attach image / PDF"}
              </button>
              <button
                onClick={send}
                disabled={!canSend}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  opacity: canSend ? 1 : 0.5,
                }}
              >
                {isSending
                  ? "Sending…"
                  : `Send${totalRecipients > 0 ? ` (${totalRecipients})` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BroadcastComposer;
