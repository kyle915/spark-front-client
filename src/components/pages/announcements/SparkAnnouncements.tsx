/**
 * Admin "Announcements" composer + feed — broadcasts to all Brand
 * Ambassadors in the current tenant and pushes them a notification.
 * Lives at /announcements. Modeled on SparkAcademyManage.
 */
import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { AnnouncementsAdminQuery } from "@/api/queries/AnnouncementsAdminQuery";
import type { AnnouncementsAdminQuery as AnnouncementsAdminQueryType } from "@api/queries/__generated__/AnnouncementsAdminQuery.graphql";
import { CreateAnnouncementMutation } from "@/api/mutations/CreateAnnouncementMutation";
import type { CreateAnnouncementMutation as CreateAnnouncementMutationType } from "@api/mutations/__generated__/CreateAnnouncementMutation.graphql";
import { DeleteAnnouncementMutation } from "@/api/mutations/DeleteAnnouncementMutation";
import type { DeleteAnnouncementMutation as DeleteAnnouncementMutationType } from "@api/mutations/__generated__/DeleteAnnouncementMutation.graphql";

type Row = {
  uuid: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdByName: string;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "Draft";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { showAlert } = useAlertStore();
  // Bumped after create/delete so the list re-queries the network and
  // the new/removed row shows immediately — no manual page refresh.
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<AnnouncementsAdminQueryType>(
    AnnouncementsAdminQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const rows = useMemo<Row[]>(
    () =>
      (data.announcementsAdmin ?? [])
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({
          uuid: String(a.uuid),
          title: a.title,
          body: a.body,
          publishedAt: a.publishedAt ?? null,
          createdByName: a.createdByName,
        })),
    [data],
  );

  const [createCommit, creating] =
    useMutation<CreateAnnouncementMutationType>(CreateAnnouncementMutation);
  const [deleteCommit, deleting] =
    useMutation<DeleteAnnouncementMutationType>(DeleteAnnouncementMutation);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const reset = useCallback(() => {
    setTitle("");
    setBody("");
    setComposing(false);
  }, []);

  const send = useCallback(() => {
    if (!title.trim()) {
      showAlert("Title is required.", "warning");
      return;
    }
    if (
      !window.confirm(
        "Send this announcement to every Brand Ambassador in this tenant? They'll get a push notification.",
      )
    )
      return;
    createCommit({
      variables: {
        input: { title, body, audience: "all_bas", tenantId },
      },
      onCompleted: (resp) => {
        if (resp.createAnnouncement.success) {
          showAlert("Announcement sent to all BAs.", "success");
          reset();
          // Refetch so the new announcement appears without a refresh.
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(
            resp.createAnnouncement.message || "Send failed.",
            "error",
          );
        }
      },
      onError: () => showAlert("Send failed.", "error"),
    });
  }, [title, body, tenantId, createCommit, showAlert, reset]);

  const onDelete = useCallback(
    (r: Row) => {
      if (!window.confirm(`Delete "${r.title}"? It disappears from the BA feed.`))
        return;
      deleteCommit({
        variables: { input: { uuid: r.uuid } },
        onCompleted: (resp) => {
          if (!resp.deleteAnnouncement.success) {
            showAlert(
              resp.deleteAnnouncement.message || "Delete failed.",
              "error",
            );
          } else {
            showAlert("Announcement deleted.", "success");
            // Refetch so the deleted row drops out without a refresh.
            setRefreshKey((k) => k + 1);
          }
        },
        onError: () => showAlert("Delete failed.", "error"),
      });
    },
    [deleteCommit, showAlert],
  );

  const busy = creating || deleting;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            ANNOUNCEMENTS
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Broadcast to BAs.
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Posts to the Announcements feed in the Spark Mobile app and pushes
            a notification to every Brand Ambassador in this tenant.
          </p>
        </div>
        <button
          onClick={() => setComposing(true)}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{ background: "var(--spark-lime)", color: "#0a0d09", border: "none" }}
        >
          ✦ New announcement
        </button>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div
            className="spark-card p-8 text-center"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No announcements yet. Post your first to reach every BA.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.uuid} className="spark-card p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{r.title}</p>
                {r.body ? (
                  <p
                    className="text-sm mt-1"
                    style={{ color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap" }}
                  >
                    {r.body}
                  </p>
                ) : null}
                <p
                  className="mono text-[10px] mt-2"
                  style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)" }}
                >
                  {fmtWhen(r.publishedAt).toUpperCase()} · {r.createdByName}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => onDelete(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
                style={{
                  background: "transparent",
                  color: "rgba(255,90,42,0.95)",
                  border: "1px solid rgba(255,90,42,0.4)",
                }}
              >
                DELETE
              </button>
            </div>
          ))
        )}
      </div>

      {composing && (
        <div
          onClick={reset}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="spark-card"
            style={{ width: "min(620px, 92vw)", padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }}
          >
            <h2 className="display text-2xl font-bold mb-4" style={{ letterSpacing: "-0.02em" }}>
              New announcement
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)" }}>
                  TITLE
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--spark-bg)", border: "1px solid var(--spark-border)", color: "var(--spark-text)" }}
                />
              </label>
              <label className="block">
                <span className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)" }}>
                  MESSAGE
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--spark-bg)", border: "1px solid var(--spark-border)", color: "var(--spark-text)" }}
                />
              </label>
              <label className="block">
                <span className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)" }}>
                  AUDIENCE
                </span>
                <select
                  value="all_bas"
                  disabled
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--spark-bg)", border: "1px solid var(--spark-border)", color: "var(--spark-text)" }}
                >
                  <option value="all_bas">All Brand Ambassadors</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={reset}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
              >
                CANCEL
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--spark-lime)", color: "#0a0d09", border: "none" }}
              >
                {busy ? "SENDING…" : "SEND TO ALL BAs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SparkAnnouncements() {
  const navigate = useNavigate();
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-3">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p style={{ color: "rgba(255,255,255,0.55)" }}>
            Announcements is a Spark Admin feature.{" "}
            <button onClick={() => navigate("/")} className="underline">
              Back to Dashboard
            </button>
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense
        fallback={
          <div className="grid place-items-center text-xs py-12" style={{ color: "rgba(255,255,255,0.45)" }}>
            Loading announcements…
          </div>
        }
      >
        {tenantId ? (
          <Inner tenantId={tenantId} />
        ) : (
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            No tenant selected.
          </div>
        )}
      </Suspense>
    </Layout>
  );
}
