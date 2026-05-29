import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AmbassadorProfileDetailQuery } from "@/api/queries/AmbassadorProfileDetailQuery";
import type { AmbassadorProfileDetailQuery as AmbassadorProfileDetailQueryType } from "@api/queries/__generated__/AmbassadorProfileDetailQuery.graphql";
import { BroadcastChatMessageMutation } from "@/api/mutations/BroadcastChatMessageMutation";
import type { BroadcastChatMessageMutation as BroadcastChatMessageMutationType } from "@api/mutations/__generated__/BroadcastChatMessageMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Openable BA TALENT profile pop-up (Search talent page).
 *
 * Shows headshot, bio, college, email + phone (click-to-copy + mailto/
 * tel), an event-photo gallery, a résumé download link, the gig-history
 * list, and the rating / on-time / jobs stats. The "DM" button opens an
 * inline quick-DM composer that sends via broadcastChatMessage — the same
 * tenant-scoped chat path the BroadcastComposer uses (delivers in-app +
 * push). A single-recipient broadcast is just a broadcast of one.
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
  color: "rgba(255,255,255,0.45)",
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

  const [dmOpen, setDmOpen] = useState(false);
  const [dmBody, setDmBody] = useState("");
  const [commitDM, dmInFlight] =
    useMutation<BroadcastChatMessageMutationType>(BroadcastChatMessageMutation);

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
        <p style={{ color: "rgba(255,255,255,0.55)" }} className="text-sm">
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

  const sendDM = () => {
    const body = dmBody.trim();
    if (!body) return;
    if (!tenantId) {
      showAlert("No active workspace to message under.", "warning");
      return;
    }
    commitDM({
      variables: {
        input: {
          ambassadorUuids: [ambassadorUuid],
          body,
          tenantId,
        },
      },
      onCompleted: (res) => {
        const ok = res?.broadcastChatMessage?.success;
        if (ok && (res?.broadcastChatMessage?.recipientCount ?? 0) > 0) {
          showAlert("Message sent.", "success");
          setDmBody("");
          setDmOpen(false);
        } else {
          showAlert(
            res?.broadcastChatMessage?.message || "Couldn't send the message.",
            "error",
          );
        }
      },
      onError: () => showAlert("Couldn't send the message.", "error"),
    });
  };

  const stats = {
    rating:
      p.ratingCount > 0 ? `★ ${p.ratingAverage.toFixed(1)}` : "—",
    jobs: String(p.jobsCount ?? 0),
    onTime: p.onTimeRate != null ? `${Math.round(p.onTimeRate)}%` : "—",
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {p.headshotUrl ? (
            <img
              src={p.headshotUrl}
              alt={p.fullName}
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
              {(p.fullName || "?")
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-lg truncate">{p.fullName}</h3>
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

      {/* Contact */}
      <div className="mt-5 grid sm:grid-cols-2 gap-2">
        {p.email && (
          <div className="flex items-center justify-between gap-2 spark-card p-2.5">
            <a
              href={`mailto:${p.email}`}
              className="text-sm truncate"
              style={{ color: "var(--spark-sky)", textDecoration: "none" }}
            >
              {p.email}
            </a>
            <button
              onClick={() => copy(p.email!, "Email")}
              style={labelMini}
              title="Copy email"
            >
              COPY
            </button>
          </div>
        )}
        {p.phone && (
          <div className="flex items-center justify-between gap-2 spark-card p-2.5">
            <a
              href={`tel:${p.phone}`}
              className="text-sm truncate"
              style={{ color: "var(--spark-sky)", textDecoration: "none" }}
            >
              {p.phone}
            </a>
            <button
              onClick={() => copy(p.phone!, "Phone")}
              style={labelMini}
              title="Copy phone"
            >
              COPY
            </button>
          </div>
        )}
      </div>

      {/* DM */}
      <div className="mt-4">
        {!dmOpen ? (
          <button
            onClick={() => setDmOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold w-full"
            style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
          >
            💬 DM {p.fullName.split(/\s+/)[0] || "BA"}
          </button>
        ) : (
          <div className="spark-card p-3">
            <textarea
              value={dmBody}
              onChange={(e) => setDmBody(e.target.value)}
              placeholder={`Message ${p.fullName.split(/\s+/)[0] || "this BA"}…`}
              rows={3}
              autoFocus
              style={{
                width: "100%",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                borderRadius: 10,
                padding: "0.6rem 0.75rem",
                color: "var(--spark-text)",
                fontSize: "0.875rem",
                outline: "none",
                resize: "vertical",
              }}
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setDmOpen(false);
                  setDmBody("");
                }}
                style={labelMini}
              >
                CANCEL
              </button>
              <button
                onClick={sendDM}
                disabled={dmInFlight || !dmBody.trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  opacity: dmInFlight || !dmBody.trim() ? 0.6 : 1,
                }}
              >
                {dmInFlight ? "Sending…" : "Send"}
              </button>
            </div>
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
            style={{ color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap" }}
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
            📄 Download résumé
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
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
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
                      style={{ color: "rgba(255,255,255,0.5)" }}
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
              style={{ color: "rgba(255,255,255,0.55)" }}
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
