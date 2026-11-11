/**
 * Admin-only "Manage" page for backend-backed Academy modules — these
 * sync to the BA mobile app via the `academyModules` query (only
 * published rows). Lives at /academy/manage. Distinct from the
 * existing /academy page (localStorage-backed, web-only).
 *
 * Phase 2 will merge the two surfaces once the localStorage shape is
 * migrated into the backend model.
 */

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { AcademyModulesAdminQuery } from "@/api/queries/AcademyModulesAdminQuery";
import type { AcademyModulesAdminQuery as AcademyModulesAdminQueryType } from "@api/queries/__generated__/AcademyModulesAdminQuery.graphql";
import { CreateAcademyModuleMutation } from "@/api/mutations/CreateAcademyModuleMutation";
import type { CreateAcademyModuleMutation as CreateAcademyModuleMutationType } from "@api/mutations/__generated__/CreateAcademyModuleMutation.graphql";
import { UpdateAcademyModuleMutation } from "@/api/mutations/UpdateAcademyModuleMutation";
import type { UpdateAcademyModuleMutation as UpdateAcademyModuleMutationType } from "@api/mutations/__generated__/UpdateAcademyModuleMutation.graphql";
import { DeleteAcademyModuleMutation } from "@/api/mutations/DeleteAcademyModuleMutation";
import type { DeleteAcademyModuleMutation as DeleteAcademyModuleMutationType } from "@api/mutations/__generated__/DeleteAcademyModuleMutation.graphql";

const KIND_OPTIONS = [
  { value: "training", label: "Training" },
  { value: "brand", label: "Brand" },
  { value: "playbook", label: "Playbook" },
  { value: "policy", label: "Policy" },
  { value: "announcement", label: "Announcement" },
];

type ModuleRow = {
  uuid: string;
  title: string;
  kind: string;
  body: string;
  order: number;
  published: boolean;
  updatedAt: string;
};

const ManageInner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<AcademyModulesAdminQueryType>(
    AcademyModulesAdminQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );
  const modules = useMemo<ModuleRow[]>(
    () =>
      (data.academyModulesAdmin ?? [])
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({
          uuid: String(m.uuid),
          title: m.title,
          kind: m.kind,
          body: m.body,
          order: m.order,
          published: m.published,
          updatedAt: m.updatedAt,
        })),
    [data],
  );

  const [createCommit, creating] =
    useMutation<CreateAcademyModuleMutationType>(CreateAcademyModuleMutation);
  const [updateCommit, updating] =
    useMutation<UpdateAcademyModuleMutationType>(UpdateAcademyModuleMutation);
  const [deleteCommit, deleting] =
    useMutation<DeleteAcademyModuleMutationType>(DeleteAcademyModuleMutation);

  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftKind, setDraftKind] = useState("training");
  const [draftBody, setDraftBody] = useState("");
  const [draftOrder, setDraftOrder] = useState(0);
  const [draftPublished, setDraftPublished] = useState(false);

  const startCreate = useCallback(() => {
    setEditing({
      uuid: "",
      title: "",
      kind: "training",
      body: "",
      order: 0,
      published: false,
      updatedAt: "",
    });
    setDraftTitle("");
    setDraftKind("training");
    setDraftBody("");
    setDraftOrder(0);
    setDraftPublished(false);
  }, []);

  const startEdit = useCallback((m: ModuleRow) => {
    setEditing(m);
    setDraftTitle(m.title);
    setDraftKind(m.kind);
    setDraftBody(m.body);
    setDraftOrder(m.order);
    setDraftPublished(m.published);
  }, []);

  const saveDraft = useCallback(() => {
    if (!editing) return;
    if (!draftTitle.trim()) {
      showAlert("Title is required.", "warning");
      return;
    }
    if (editing.uuid) {
      updateCommit({
        variables: {
          input: {
            uuid: editing.uuid,
            title: draftTitle,
            kind: draftKind,
            body: draftBody,
            order: draftOrder,
            published: draftPublished,
          },
        },
        onCompleted: (resp) => {
          if (resp.updateAcademyModule.success) {
            showAlert("Module updated.", "success");
            setEditing(null);
          } else {
            showAlert(
              resp.updateAcademyModule.message || "Update failed.",
              "error",
            );
          }
        },
        onError: () => showAlert("Update failed.", "error"),
      });
    } else {
      createCommit({
        variables: {
          input: {
            title: draftTitle,
            kind: draftKind,
            body: draftBody,
            order: draftOrder,
            published: draftPublished,
            tenantId,
          },
        },
        onCompleted: (resp) => {
          if (resp.createAcademyModule.success) {
            showAlert("Module created.", "success");
            setEditing(null);
          } else {
            showAlert(
              resp.createAcademyModule.message || "Create failed.",
              "error",
            );
          }
        },
        onError: () => showAlert("Create failed.", "error"),
      });
    }
  }, [
    editing,
    draftTitle,
    draftKind,
    draftBody,
    draftOrder,
    draftPublished,
    tenantId,
    createCommit,
    updateCommit,
    showAlert,
  ]);

  const togglePublish = useCallback(
    (m: ModuleRow) => {
      updateCommit({
        variables: {
          input: { uuid: m.uuid, published: !m.published },
        },
        onCompleted: (resp) => {
          if (!resp.updateAcademyModule.success) {
            showAlert(
              resp.updateAcademyModule.message || "Publish toggle failed.",
              "error",
            );
          }
        },
        onError: () => showAlert("Publish toggle failed.", "error"),
      });
    },
    [updateCommit, showAlert],
  );

  const onDelete = useCallback(
    (m: ModuleRow) => {
      if (
        !window.confirm(
          `Delete "${m.title}"? This removes it from the BA mobile app.`,
        )
      )
        return;
      deleteCommit({
        variables: { input: { uuid: m.uuid } },
        onCompleted: (resp) => {
          if (resp.deleteAcademyModule.success) {
            showAlert("Module deleted.", "success");
          } else {
            showAlert(
              resp.deleteAcademyModule.message || "Delete failed.",
              "error",
            );
          }
        },
        onError: () => showAlert("Delete failed.", "error"),
      });
    },
    [deleteCommit, showAlert],
  );

  const busy = creating || updating || deleting;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            ACADEMY · MANAGE
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Mobile library.
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Published modules appear in the Academy tab of the Spark Mobile
            app for your Brand Ambassadors.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            border: "none",
          }}
        >
          ✦ New module
        </button>
      </div>

      <div className="space-y-2">
        {modules.length === 0 ? (
          <SparkEmptyState
            title="No modules yet"
            body="Create your first to publish it to mobile."
          />
        ) : (
          modules.map((m) => (
            <div
              key={m.uuid}
              className="spark-card p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    {m.kind.toUpperCase()}
                  </span>
                  {m.published ? (
                    <span className="chip chip-lime">PUBLISHED</span>
                  ) : (
                    <span className="chip chip-muted">DRAFT</span>
                  )}
                </div>
                <p className="font-bold text-sm truncate">{m.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={busy}
                  onClick={() => togglePublish(m)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: "transparent",
                    color: m.published ? "var(--spark-orange)" : "var(--spark-lime)",
                    border: `1px solid ${
                      m.published ? "var(--spark-orange)" : "var(--spark-lime)"
                    }`,
                  }}
                >
                  {m.published ? "UNPUBLISH" : "PUBLISH"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => startEdit(m)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  EDIT
                </button>
                <button
                  disabled={busy}
                  onClick={() => onDelete(m)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: "transparent",
                    color: "rgba(255,90,42,0.95)",
                    border: "1px solid rgba(255,90,42,0.4)",
                  }}
                >
                  DELETE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="spark-card"
            style={{
              width: "min(640px, 92vw)",
              padding: "1.5rem",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2
              className="display text-2xl font-bold mb-4"
              style={{ letterSpacing: "-0.02em" }}
            >
              {editing.uuid ? "Edit module" : "New module"}
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  TITLE
                </span>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                  maxLength={200}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    KIND
                  </span>
                  <select
                    value={draftKind}
                    onChange={(e) => setDraftKind(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: "var(--spark-bg)",
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                    }}
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    ORDER (LOWER = HIGHER)
                  </span>
                  <input
                    type="number"
                    value={draftOrder}
                    onChange={(e) =>
                      setDraftOrder(parseInt(e.target.value, 10) || 0)
                    }
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: "var(--spark-bg)",
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                    }}
                  />
                </label>
              </div>
              <label className="block">
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  BODY (MARKDOWN)
                </span>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={10}
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm font-mono"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftPublished}
                  onChange={(e) => setDraftPublished(e.target.checked)}
                />
                <span className="text-sm">
                  Publish to mobile (visible to BAs immediately)
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditing(null)}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={saveDraft}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                  border: "none",
                }}
              >
                {busy ? "SAVING…" : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SparkAcademyManage() {
  const navigate = useNavigate();
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-3">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p style={{ color: "var(--spark-text-meta)" }}>
            Manage Academy is a Spark Admin feature.{" "}
            <button
              onClick={() => navigate("/academy")}
              className="underline"
            >
              Back to Academy
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
          <div
            className="grid place-items-center text-xs py-12"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading Academy library…
          </div>
        }
      >
        {tenantId ? (
          <ManageInner tenantId={tenantId} />
        ) : (
          <div
            className="text-xs"
            style={{ color: "var(--spark-text-meta)" }}
          >
            No tenant selected.
          </div>
        )}
      </Suspense>
    </Layout>
  );
}
