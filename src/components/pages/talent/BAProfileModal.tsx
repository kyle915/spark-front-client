import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AmbassadorProfileDetailQuery } from "@/api/queries/AmbassadorProfileDetailQuery";
import type { AmbassadorProfileDetailQuery as AmbassadorProfileDetailQueryType } from "@api/queries/__generated__/AmbassadorProfileDetailQuery.graphql";
import { OpenChatThreadMutation } from "@/api/mutations/OpenChatThreadMutation";
import type { OpenChatThreadMutation as OpenChatThreadMutationType } from "@api/mutations/__generated__/OpenChatThreadMutation.graphql";
import ChatConversation from "@/chat/ChatConversation";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { displayEmail, formatPhone } from "./talentDisplay";
import { isWalkupPlaceholderEmail, walkupPhoneFromEmail } from "@/utils/clientSafeBaName";

/**
 * Openable BA TALENT profile pop-up (Search talent page).
 *
 * Shows headshot, bio, college, email + phone (click-to-copy + mailto/
 * tel), an event-photo gallery, a résumé download link, the gig-history
 * list, and the rating / on-time / jobs stats. The "DM" button opens the
 * real two-way chat thread with this BA inline (open/get-or-create via
 * openChatThread → the shared <ChatConversation> renders message history
 * + a reply box, exactly like the main Chat page). Replies deliver
 * in-app + push and mark-as-read fires on open. Tenant scoping is
 * enforced server-side by openChatThread (keyed on the ambassador).
 */

type Props = {
  ambassadorUuid: string;
  /** Fallback display name (from the card) shown in the header before
   *  the detail query resolves. */
  fallbackName?: string;
  onClose: () => void;
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(2px)",
  zIndex: 60,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "3rem 1rem",
  overflowY: "auto",
};

const panel: React.CSSProperties = {
  background: "var(--spark-surface, #14181150)",
  border: "1px solid var(--spark-border)",
  borderRadius: 18,
  width: "100%",
  maxWidth: 640,
  padding: "1.75rem",
};

const labelMini: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 9,
  letterSpacing: "0.16em",
  color: "var(--spark-text-meta)",
  textTransform: "uppercase",
};

const StatBlock: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <div className="text-center">
    <p className="tab-num text-xl font-bold" style={{ color: "var(--spark-lime)" }}>
      {value}
    </p>
    <p style={labelMini}>{label}</p>
  </div>
);

const ProfileInner: React.FC<{
  ambassadorUuid: string;
  onClose: () => void;
}> = ({ ambassadorUuid, onClose }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<AmbassadorProfileDetailQueryType>(
    AmbassadorProfileDetailQuery,
    { ambassadorUuid, tenantId: tenantId ?? null },
    { fetchPolicy: "store-and-network" },
  );

  // DM: open/get-or-create the 1:1 thread, then render it inline. The
  // thread uuid is what <ChatConversation> needs; once we have it the
  // DM area swaps from the button to the full conversation pane.
  const [threadUuid, setThreadUuid] = useState<string | null>(null);
  const [commitOpenThread, openingThread] =
    useMutation<OpenChatThreadMutationType>(OpenChatThreadMutation);

  const p = data?.ambassadorProfileDetail;

  if (!p) {
    return (
      <div style={panel}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Profile unavailable</h3>
          <button onClick={onClose} style={labelMini}>
            CLOSE
          </button>
        </div>
        <p style={{ color: "var(--spark-text-meta)" }} className="text-sm">
          This BA isn't reachable in your current workspace, or no longer
          exists.
        </p>
      </div>
    );
  }

  const copy = (value: string, what: string) => {
    navigator.clipboard?.writeText(value).then(
      () => showAlert(`${what} copied`, "success"),
      () => showAlert(`Couldn't copy ${what.toLowerCase()}`, "error"),
    );
  };

  const openDM = () => {
    if (openingThread || threadUuid) return;
    if (!tenantId) {
      showAlert("No active workspace to message under.", "warning");
      return;
    }
    // open_chat_thread gets-or-creates the persistent 1:1 (general) DM
    // for this BA. No jobUuid → general thread. Tenant scoping is
    // enforced server-side from the admin's auth context.
    commitOpenThread({
      variables: { input: { ambassadorUuid } },
      onCompleted: (res) => {
        const uuid = res?.openChatThread?.uuid;
        if (uuid) {
          setThreadUuid(String(uuid));
        } else {
          showAlert("Couldn't open the conversation.", "error");
        }
      },
      onError: (err) =>
        showAlert(`Couldn't open the conversation: ${err.message}`, "error"),
    });
  };

  const stats = {
    rating:
      p.ratingCount > 0 ? `★ ${p.ratingAverage.toFixed(1)}` : "—",
    jobs: String(p.jobsCount ?? 0),
    onTime: p.onTimeRate != null ? `${Math.round(p.onTimeRate)}%` : "—",
  };

  // Walk-up identities are stored under checkin-<phone>@walkup.spark — an
  // internal key, never shown. Name them by phone; offer no email.
  const email = displayEmail(p.email);
  const phone = formatPhone(p.phone) || walkupPhoneFromEmail(p.email);
  const fullName = isWalkupPlaceholderEmail(p.fullName)
    ? phone || "BA"
    : p.fullName;
  const firstName = fullName.split(/\s+/)[0] || "BA";

  return (
    <div style={panel}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {p.headshotUrl ? (
            <img
              src={p.headshotUrl}
              alt={fullName}
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              className="spark-avatar"
              style={{ width: 64, height: 64, borderRadius: 16, fontSize: "1.2rem" }}
            >
              {(/[A-Za-z]/.test(fullName) ? fullName : "BA")
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-lg truncate">{fullName}</h3>
            {(p.college || p.inCollege) && (
              <p style={labelMini} className="mt-0.5 truncate">
                {p.college || "Student"}
                {p.inCollege ? " · IN COLLEGE" : ""}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} style={labelMini} aria-label="Close">
          CLOSE
        </button>
      </div>

      {/* Stats */}
      <div
        className="mt-5 pt-4 grid grid-cols-3 gap-2"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <StatBlock value={stats.rating} label="RATING" />
        <StatBlock value={stats.jobs} label="JOBS" />
        <StatBlock value={stats.onTime} label="ON-TIME" />
      </div>

      {/* Reliability — completed vs dropped (+ claimed). Same dependability
          signal that orders open-shift alerts most-reliable-first. */}
      <div className="mt-2 spark-card p-3">
        <div className="flex items-center justify-between gap-2">
          <span style={labelMini}>RELIABILITY</span>
          <span
            className="text-sm font-bold"
            style={{
              color:
                p.reliabilityScore == null
                  ? "rgba(var(--spark-ink-rgb),0.45)"
                  : p.reliabilityScore >= 70
                    ? "var(--spark-lime)"
                    : p.reliabilityScore >= 40
                      ? "#fbbf24"
                      : "#f87171",
            }}
          >
            {p.reliabilityScore == null
              ? "New — no history yet"
              : `${p.reliabilityScore}% · ${p.reliabilityLabel}`}
          </span>
        </div>
        {p.completedShifts + p.claimedShifts + p.droppedShifts > 0 && (
          <p style={{ ...labelMini, letterSpacing: "0.04em", marginTop: 6 }}>
            {p.completedShifts} COMPLETED · {p.claimedShifts} CLAIMED · {p.droppedShifts} DROPPED
          </p>
        )}
      </div>

      {/* Contact */}
      <div className="mt-5 grid sm:grid-cols-2 gap-2">
        {email && (
          <div className="flex items-center justify-between gap-2 spark-card p-2.5">
            <a
              href={`mailto:${email}`}
              className="text-sm truncate"
              style={{ color: "var(--spark-sky)", textDecoration: "none" }}
            >
              {email}
            </a>
            <button
              onClick={() => copy(email, "Email")}
              style={labelMini}
              title="Copy email"
            >
              COPY
            </button>
          </div>
        )}
        {phone && (
          <div className="flex items-center justify-between gap-2 spark-card p-2.5">
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="text-sm truncate"
              style={{ color: "var(--spark-sky)", textDecoration: "none" }}
            >
              {phone}
            </a>
            <button
              onClick={() => copy(phone, "Phone")}
              style={labelMini}
              title="Copy phone"
            >
              COPY
            </button>
          </div>
        )}
      </div>

      {/* DM — open the real two-way thread inline */}
      <div className="mt-4">
        {!threadUuid ? (
          <button
            onClick={openDM}
            disabled={openingThread}
            className="px-4 py-2 rounded-xl text-sm font-semibold w-full"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              opacity: openingThread ? 0.6 : 1,
            }}
          >
            {openingThread
              ? "Opening…"
              : `DM ${firstName}`}
          </button>
        ) : (
          <div
            className="spark-card overflow-hidden"
            style={{ padding: 0 }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--spark-border)" }}
            >
              <p style={labelMini}>DIRECT MESSAGE · {firstName.toUpperCase()}</p>
              <button
                onClick={() => setThreadUuid(null)}
                style={labelMini}
                title="Collapse conversation"
              >
                COLLAPSE
              </button>
            </div>
            <Suspense
              fallback={
                <div className="p-6" style={labelMini}>
                  LOADING CONVERSATION…
                </div>
              }
            >
              {/* Reuse the exact Chat-page thread pane: history bubbles
                  (inbound + outbound), scrollable newest-at-bottom, +
                  reply box. Header hidden — the modal already shows the
                  BA's name. Mark-as-read + push are handled inside. */}
              <ChatConversation
                threadUuid={threadUuid}
                showHeader={false}
                height="min(460px, 60vh)"
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Bio */}
      {p.bio && (
        <div className="mt-5">
          <p style={labelMini} className="mb-1">
            ABOUT
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--spark-text-secondary)", whiteSpace: "pre-wrap" }}
          >
            {p.bio}
          </p>
        </div>
      )}

      {/* Résumé */}
      {p.resumeUrl && (
        <div className="mt-4">
          <a
            href={p.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--spark-sky)", textDecoration: "none" }}
          >
            Download résumé
          </a>
        </div>
      )}

      {/* Photo gallery */}
      {p.photos.length > 0 && (
        <div className="mt-5">
          <p style={labelMini} className="mb-2">
            EVENT PHOTOS
          </p>
          <div className="grid grid-cols-3 gap-2">
            {p.photos.map((ph) =>
              ph.imageUrl ? (
                <a
                  key={ph.uuid}
                  href={ph.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={ph.imageUrl}
                    alt={ph.caption || "Event photo"}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--spark-border)",
                    }}
                  />
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Gig history */}
      <div className="mt-5">
        <p style={labelMini} className="mb-2">
          GIG HISTORY · {p.gigHistory.length}
        </p>
        {p.gigHistory.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            No gigs in this workspace yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {p.gigHistory.map((g) => (
              <div
                key={g.eventUuid}
                className="flex items-center justify-between gap-2 spark-card p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {g.venue || g.brandName || "Gig"}
                  </p>
                  <p style={labelMini} className="truncate">
                    {[g.brandName, g.stateCode].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p style={labelMini}>{g.status?.toUpperCase()}</p>
                  {g.date && (
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {new Date(g.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function BAProfileModal({
  ambassadorUuid,
  fallbackName,
  onClose,
}: Props) {
  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Suspense
        fallback={
          <div style={panel}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg truncate">
                {fallbackName || "Loading profile…"}
              </h3>
              <button onClick={onClose} style={labelMini}>
                CLOSE
              </button>
            </div>
            <p
              className="text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading profile…
            </p>
          </div>
        }
      >
        <ProfileInner ambassadorUuid={ambassadorUuid} onClose={onClose} />
      </Suspense>
    </div>
  );
}
