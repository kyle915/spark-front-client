import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { CustomRecapTemplateBuilderQuery } from "@/api/queries/CustomRecapTemplateBuilderQuery";
import type { CustomRecapTemplateBuilderQuery as CustomRecapTemplateBuilderQueryType } from "@api/queries/__generated__/CustomRecapTemplateBuilderQuery.graphql";
import { RemoveCustomFieldMutation } from "@/api/mutations/RemoveCustomFieldMutation";
import type { RemoveCustomFieldMutation as RemoveCustomFieldMutationType } from "@api/mutations/__generated__/RemoveCustomFieldMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Recap Templates.
 * Wireframe: spark-demo/index.html recapBuilder (~line 2744) and adjacent.
 *
 * We surface templates by reducing the customRecaps result set down to
 * unique customRecapTemplate entries, with usage counts. A dedicated
 * templates-list endpoint would be cleaner; until then, this works against
 * the existing schema.
 */

type Template = {
  id: string;
  name: string;
  usage: number;
  lastUsed: string | null;
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Template manager modal state. Keyed off template id; null = closed.
  // Lives on the page (not per-card) so we can refetch + re-render
  // when a field is removed.
  const [managingTemplateId, setManagingTemplateId] = useState<string | null>(
    null,
  );

  const data = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  // Templates-with-fields, fetched separately so the modal can list
  // the actual CustomField rows (the recaps query only exposes id +
  // name on customRecapTemplate, not the fields underneath).
  const templateData = useLazyLoadQuery<CustomRecapTemplateBuilderQueryType>(
    CustomRecapTemplateBuilderQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-and-network" },
  );
  const templatesWithFields = useMemo(
    () =>
      (templateData?.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [templateData],
  );
  const managingTemplate = useMemo(
    () =>
      managingTemplateId
        ? templatesWithFields.find(
            (t) => String(t.id) === managingTemplateId,
          ) ?? null
        : null,
    [managingTemplateId, templatesWithFields],
  );

  const templates: Template[] = useMemo(() => {
    const map = new Map<string, Template>();
    const recaps =
      data?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of recaps) {
      const t = r.customRecapTemplate;
      if (!t) continue;
      const id = String(t.id);
      const existing = map.get(id);
      const submittedAt = r.submittedAt ?? r.createdAt;
      if (!existing) {
        map.set(id, {
          id,
          name: t.name ?? "Untitled template",
          usage: 1,
          lastUsed: submittedAt ?? null,
        });
      } else {
        existing.usage += 1;
        if (
          submittedAt &&
          (!existing.lastUsed ||
            new Date(submittedAt) > new Date(existing.lastUsed))
        ) {
          existing.lastUsed = submittedAt;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.usage - a.usage);
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            RECAP TEMPLATES · {templates.length} ACTIVE
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Build the recap.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Custom recap shapes per brand — what BAs see when they file
            from the field.
          </p>
        </div>
        <button
          onClick={() => navigate("/recaps/templates/new")}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.35)",
          }}
        >
          + New template
        </button>
      </div>

      {/* Templates grid */}
      {templates.length === 0 ? (
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No templates yet. Build one to start collecting custom recap
          fields per brand.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const fieldsList =
              templatesWithFields.find((tw) => String(tw.id) === t.id)
                ?.customField ?? [];
            return (
              <div key={t.id} className="spark-card hov p-5">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    TPL-{t.id.slice(-4).toUpperCase()}
                  </span>
                  <span className="chip chip-lime">● ACTIVE</span>
                </div>
                <h3
                  className="display text-lg font-bold mb-1"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {t.name}
                </h3>
                {t.lastUsed && (
                  <p
                    className="mono text-[10px] uppercase mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    Last used · {fmtDate(t.lastUsed)}
                  </p>
                )}
                <div
                  className="mt-4 pt-3 grid grid-cols-2 gap-2 text-center"
                  style={{ borderTop: "1px solid var(--spark-border)" }}
                >
                  <div>
                    <p
                      className="tab-num text-lg font-bold"
                      style={{ color: "var(--spark-lime)" }}
                    >
                      {t.usage}
                    </p>
                    <p className="label-mini">RECAPS</p>
                  </div>
                  <div>
                    <p
                      className="tab-num text-lg font-bold"
                      style={{
                        color:
                          fieldsList.length > 0
                            ? "var(--spark-text)"
                            : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {fieldsList.length || "—"}
                    </p>
                    <p className="label-mini">FIELDS</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate("/recap/custom-list")}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: "transparent",
                      color: "var(--spark-text)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    View recaps
                  </button>
                  <button
                    onClick={() => setManagingTemplateId(t.id)}
                    disabled={fieldsList.length === 0}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: "transparent",
                      color:
                        fieldsList.length === 0
                          ? "rgba(255,255,255,0.35)"
                          : "var(--spark-text)",
                      border: "1px solid var(--spark-border)",
                      cursor:
                        fieldsList.length === 0
                          ? "not-allowed"
                          : "pointer",
                    }}
                    title={
                      fieldsList.length === 0
                        ? "No fields loaded yet"
                        : "Manage fields on this template"
                    }
                  >
                    Manage fields
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {managingTemplate && (
        <ManageFieldsModal
          templateName={managingTemplate.name ?? "Template"}
          fields={(managingTemplate.customField ?? [])
            .filter((f): f is NonNullable<typeof f> => Boolean(f))
            .map((f) => ({
              id: String(f.id),
              name: f.name ?? "(unnamed)",
              required: Boolean(f.required),
            }))}
          onClose={() => setManagingTemplateId(null)}
        />
      )}
    </div>
  );
};

const ManageFieldsModal: React.FC<{
  templateName: string;
  fields: { id: string; name: string; required: boolean }[];
  onClose: () => void;
}> = ({ templateName, fields, onClose }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitRemove, isRemoving] =
    useMutation<RemoveCustomFieldMutationType>(RemoveCustomFieldMutation);
  // Tracks the field id mid-confirm so we can show inline "are you
  // sure" UX without a system dialog (system dialogs eat focus on
  // mobile and feel disconnected from the page state).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const remove = (fieldId: string, fieldName: string) => {
    commitRemove({
      variables: {
        input: {
          id: fieldId,
          // Force-cascade existing CustomFieldValue rows so a field
          // with submitted data can actually be removed. The backend
          // wraps both deletes in a single transaction.
          deleteValues: true,
        },
      },
      onCompleted: (res) => {
        const payload = res.removeCustomField;
        if (payload?.success) {
          showAlert(
            `Removed "${fieldName}" from "${templateName}".`,
            "success",
          );
          setConfirmingId(null);
        } else {
          showAlert(payload?.message ?? "Remove failed.", "error");
        }
      },
      onError: (err) =>
        showAlert(`Remove failed: ${err.message}`, "error"),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="spark-card max-w-lg w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              MANAGE FIELDS
            </p>
            <h2
              className="display text-xl font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              {templateName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
          Removing a field also deletes any submitted values for it
          across every recap that used this template. Use this when a
          field was a mistake — don't use it as a value-correction tool.
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {fields.length === 0 ? (
            <p
              className="text-sm py-6 text-center"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No fields on this template.
            </p>
          ) : (
            fields.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p
                    className="mono text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {f.required ? "Required · " : ""}id {f.id.slice(-6)}
                  </p>
                </div>
                {confirmingId === f.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isRemoving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "transparent",
                        color: "var(--spark-text)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => remove(f.id, f.name)}
                      disabled={isRemoving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "var(--spark-orange, #ef5a2a)",
                        color: "#0a0d09",
                      }}
                    >
                      {isRemoving ? "Removing…" : "Confirm remove"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(f.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                    style={{
                      background: "transparent",
                      color: "rgba(239,90,42,0.9)",
                      border: "1px solid rgba(239,90,42,0.4)",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default function SparkRecapTemplates() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading templates…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
