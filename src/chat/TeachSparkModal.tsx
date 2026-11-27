import React, { useEffect, useState } from "react";
import { BookOpen, Sparkles, X } from "lucide-react";
import { commitMutation } from "relay-runtime";
import environment from "@/api/relay/environment";
import useSparkRole from "@/hooks/useSparkRole";
import { useAlertStore } from "@/store/alertStore";
import {
  DistillChatToHelpKnowledgeMutation,
  UpsertSparkHelpArticleMutation,
} from "@/api/helpKnowledgeApi";
import type { helpKnowledgeApiDistillChatMutation } from "@api/__generated__/helpKnowledgeApiDistillChatMutation.graphql";
import type { helpKnowledgeApiUpsertArticleMutation } from "@api/__generated__/helpKnowledgeApiUpsertArticleMutation.graphql";
import {
  HELP_AUDIENCE_OPTIONS,
  HELP_CATEGORY_OPTIONS,
  parseTagsInput,
  SPARK_ROUTE_PRESETS,
  type HelpAudience,
} from "@/components/pages/help/helpKnowledgeHelpers";

/**
 * Admin-only "Teach Spark" modal launched from a resolved reply inside `/chat`.
 *
 * Uses OpenAI to distill a PII-scrubbed FAQ/SOP draft, lets the Ignite admin
 * explicitly pick the audience (Ignite Admins Only vs Clients & Admins vs
 * Brand Clients), and saves + embeds the article via `text-embedding-3-small`.
 *
 * Brand clients NEVER see or invoke this modal (enforced both here and on the
 * backend).
 */
export const TeachSparkModal: React.FC<{
  threadUuid: string;
  messageUuid: string;
  onClose: () => void;
}> = ({ threadUuid, messageUuid, onClose }) => {
  const { isAdmin } = useSparkRole();
  const showAlert = useAlertStore((s) => s.showAlert);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("field_ui");
  const [audience, setAudience] = useState<HelpAudience>("admin");
  const [tagsRaw, setTagsRaw] = useState("");
  const [routePath, setRoutePath] = useState("/chat");
  const [routeLabel, setRouteLabel] = useState("Open Chat");

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    commitMutation<helpKnowledgeApiDistillChatMutation>(environment, {
      mutation: DistillChatToHelpKnowledgeMutation,
      variables: { threadUuid, messageUuid },
      onCompleted: (res) => {
        if (!active) return;
        const r = res.distillChatToHelpKnowledge;
        setLoading(false);
        if (!r.ok) {
          setError(r.reason || "Could not distill that message.");
          return;
        }
        setTitle(r.title);
        setBody(r.body);
        setCategory(r.category || "field_ui");
        setAudience(
          r.audience === "all" || r.audience === "client" ? r.audience : "admin",
        );
        setTagsRaw((r.tags || []).join(", "));
        setRoutePath(r.routePath || "/chat");
        setRouteLabel(r.routeLabel || "Open Chat");
      },
      onError: () => {
        if (!active) return;
        setLoading(false);
        setError("Could not reach Spark AI right now.");
      },
    });
    return () => {
      active = false;
    };
  }, [isAdmin, threadUuid, messageUuid]);

  if (!isAdmin) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    setError(null);
    commitMutation<helpKnowledgeApiUpsertArticleMutation>(environment, {
      mutation: UpsertSparkHelpArticleMutation,
      variables: {
        input: {
          title: title.trim(),
          body: body.trim(),
          category,
          audience,
          routePath: routePath.trim(),
          routeLabel: routeLabel.trim(),
          tags: parseTagsInput(tagsRaw),
          sourceKind: "chat_taught",
          isActive: true,
        },
      },
      onCompleted: (res) => {
        setSaving(false);
        const r = res.upsertSparkHelpArticle;
        if (!r.ok) {
          setError(r.reason || "Could not save to Spark Knowledge.");
          return;
        }
        showAlert(
          r.article?.hasEmbedding
            ? "Saved & embedded into Spark Knowledge."
            : "Saved into Spark Knowledge.",
          "success",
        );
        onClose();
      },
      onError: () => {
        setSaving(false);
        setError("Save failed — please try again.");
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20, 22, 15, 0.48)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Teach Spark Knowledge"
        className="w-full max-w-xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--spark-surface, #ffffff)",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="mono text-[10px] uppercase inline-flex items-center gap-1.5"
              style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
            >
              <Sparkles size={12} /> ADMIN ONLY · TEACH SPARK
            </p>
            <h2 className="display text-xl font-bold mt-0.5">
              Save answer to Spark Knowledge
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
              Review the PII-scrubbed product-help draft below and choose visibility. Internal Ignite financials and processes are blocked from Help Knowledge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg"
            style={{
              background: "var(--spark-surface-2)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm py-8 text-center animate-pulse" style={{ color: "var(--spark-text-meta)" }}>
            Distilling conversation &amp; removing personal details…
          </p>
        ) : (
          <form onSubmit={save} className="space-y-3.5">
            {error ? (
              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: "rgba(210,72,27,0.10)",
                  color: "var(--spark-flag-ink, #a8340f)",
                  border: "1px solid rgba(210,72,27,0.3)",
                }}
              >
                {error}
              </p>
            ) : null}

            <div>
              <label className="block text-xs font-semibold mb-1">
                Article title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={180}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--spark-bg)",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Audience visibility
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as HelpAudience)}
                  className="w-full rounded-lg px-3 py-2 text-xs font-medium"
                  style={{
                    background: "var(--spark-bg)",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  {HELP_AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs font-medium"
                  style={{
                    background: "var(--spark-bg)",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  {HELP_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
              {HELP_AUDIENCE_OPTIONS.find((o) => o.value === audience)?.description}
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Answer / product guidance
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                className="w-full rounded-lg px-3 py-2 text-sm leading-relaxed"
                style={{
                  background: "var(--spark-bg)",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Linked Spark page (optional)
                </label>
                <select
                  value={routePath}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRoutePath(next);
                    const preset = SPARK_ROUTE_PRESETS.find((p) => p.path === next);
                    if (preset) setRouteLabel(preset.path ? preset.label : "");
                  }}
                  className="w-full rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "var(--spark-bg)",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  {SPARK_ROUTE_PRESETS.map((p) => (
                    <option key={p.path || "none"} value={p.path}>
                      {p.path ? `${p.label} (${p.path})` : p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Keywords / tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="shift, check-in, receipt"
                  className="w-full rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "var(--spark-bg)",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim() || !body.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                <BookOpen size={13} />
                {saving ? "Saving & embedding…" : "Save to Spark Knowledge"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TeachSparkModal;
