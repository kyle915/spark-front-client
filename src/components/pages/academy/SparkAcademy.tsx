import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import {
  loadModules,
  saveModules,
  newModule,
  KIND_LABEL,
  KIND_COLOR,
  type AcademyModule,
  type AcademyKind,
} from "@/lib/academy";

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.75rem 0.95rem",
  color: "var(--spark-text)",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%",
};

const Card: React.FC<{
  m: AcademyModule;
  onOpen: () => void;
  isAdmin: boolean;
  onDelete: () => void;
}> = ({ m, onOpen, isAdmin, onDelete }) => {
  const color = KIND_COLOR[m.kind];
  return (
    <div className="spark-card hov p-5 cursor-pointer" onClick={onOpen}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color,
          }}
        >
          {KIND_LABEL[m.kind].toUpperCase()}
        </span>
        {m.published ? (
          <span className="chip chip-lime">PUBLISHED</span>
        ) : (
          <span className="chip chip-muted">DRAFT</span>
        )}
      </div>
      <h3
        className="display text-lg font-bold mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        {m.title}
      </h3>
      {m.summary && (
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {m.summary}
        </p>
      )}
      <div className="flex items-center justify-between mt-4">
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {m.estMinutes} MIN · {m.attachments.length} ATTACHMENT
          {m.attachments.length === 1 ? "" : "S"}
        </span>
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-orange)",
            }}
          >
            DELETE
          </button>
        )}
      </div>
    </div>
  );
};

const Editor: React.FC<{
  module: AcademyModule;
  onChange: (m: AcademyModule) => void;
  onClose: () => void;
}> = ({ module: m, onChange, onClose }) => {
  const update = (patch: Partial<AcademyModule>) =>
    onChange({ ...m, ...patch, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-5">
      <button
        onClick={onClose}
        className="mono text-[11px] transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        ← BACK TO ACADEMY
      </button>

      <div className="spark-card p-6 space-y-4">
        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
          <div>
            <label className="label-mini block mb-1.5">Title</label>
            <input
              style={inputStyle}
              value={m.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Liquid Death · Brand 101"
            />
          </div>
          <div>
            <label className="label-mini block mb-1.5">Kind</label>
            <select
              style={inputStyle}
              value={m.kind}
              onChange={(e) => update({ kind: e.target.value as AcademyKind })}
            >
              {(Object.keys(KIND_LABEL) as AcademyKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label-mini block mb-1.5">Summary</label>
          <input
            style={inputStyle}
            value={m.summary}
            onChange={(e) => update({ summary: e.target.value })}
            placeholder="One-liner the BA sees on the module card"
          />
        </div>
        <div>
          <label className="label-mini block mb-1.5">Estimated minutes</label>
          <input
            style={{ ...inputStyle, maxWidth: 120 }}
            type="number"
            min={1}
            max={120}
            value={m.estMinutes}
            onChange={(e) =>
              update({ estMinutes: Math.max(1, parseInt(e.target.value, 10) || 5) })
            }
          />
        </div>
      </div>

      <div className="spark-card p-6 space-y-3">
        <label className="label-mini">Module content</label>
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 260 }}
          rows={12}
          value={m.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder={`Write the brief. Plain text or markdown.

Example:
# Brand voice
Liquid Death speaks to consumers like a heavy metal band that...

# Key talking points
1. "Murder your thirst" — humor first.
2. Aluminum cans are 100% recyclable.
3. Sustainability storyline.

# What to say (and not)
...`}
        />
      </div>

      <div className="spark-card p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="label-mini">Attachments</label>
          <button
            onClick={() => {
              const url = prompt("Paste a URL (PDF, video, doc):");
              if (!url) return;
              const name = prompt("Name?", "Attachment") || "Attachment";
              const ext = url.split(".").pop()?.toLowerCase() ?? "";
              const kind: import("@/lib/academy").AcademyAttachment["kind"] =
                ext === "pdf"
                  ? "pdf"
                  : ["mp4", "mov", "webm"].includes(ext)
                    ? "video"
                    : ["jpg", "jpeg", "png", "webp"].includes(ext)
                      ? "image"
                      : "link";
              update({
                attachments: [
                  ...m.attachments,
                  {
                    id: `att_${Date.now()}`,
                    name,
                    url,
                    kind,
                  },
                ],
              });
            }}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-lime)",
            }}
          >
            + ADD URL
          </button>
        </div>
        {m.attachments.length === 0 && (
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No attachments yet. Paste a PDF or video link to add one.
          </p>
        )}
        {m.attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 py-2"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{a.name}</p>
              <p
                className="mono text-[10px] truncate"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {a.kind.toUpperCase()} · {a.url}
              </p>
            </div>
            <button
              onClick={() =>
                update({
                  attachments: m.attachments.filter((x) => x.id !== a.id),
                })
              }
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-orange)",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div
        className="spark-card p-5"
        style={{
          borderColor: "rgba(197,245,70,0.25)",
          background:
            "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
        }}
      >
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-lime)",
          }}
        >
          PUBLISH
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={m.published}
            onChange={(e) => update({ published: e.target.checked })}
            style={{ accentColor: "var(--spark-lime)" }}
          />
          Published — visible to BAs in their academy
        </label>
      </div>
    </div>
  );
};

export default function SparkAcademy() {
  const { tenantId, tenantMeta } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const navigate = useNavigate();
  const [modules, setModules] = useState<AcademyModule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AcademyKind>("all");

  useEffect(() => {
    if (tenantId) setModules(loadModules(tenantId));
  }, [tenantId]);

  const persist = (next: AcademyModule[]) => {
    if (!tenantId) return;
    saveModules(tenantId, next);
    setModules(next);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return modules.filter((m) => {
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (!isAdmin && !m.published) return false;
      if (
        q &&
        !m.title.toLowerCase().includes(q) &&
        !m.summary.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [modules, kindFilter, search, isAdmin]);

  const editing = useMemo(
    () => modules.find((x) => x.id === editingId),
    [modules, editingId],
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        {!editing && (
          <>
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  SPARK ACADEMY · {filtered.length} MODULE
                  {filtered.length === 1 ? "" : "S"}
                </p>
                <h1
                  className="display text-4xl font-bold mt-2"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  Train your BAs.
                </h1>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Brand 101, product deep-dives, activation playbooks,
                  compliance. Link modules to a job so the BA reads them
                  before clocking in.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    const m = newModule(tenantMeta?.requestUrlName ?? "");
                    persist([m, ...modules]);
                    setEditingId(m.id);
                  }}
                  className="px-5 py-3 rounded-2xl text-sm font-semibold"
                  style={{
                    background: "var(--spark-lime)",
                    color: "#0a0d09",
                    boxShadow: "0 0 20px rgba(197,245,70,0.35)",
                  }}
                >
                  + New module
                </button>
              )}
            </div>

            <div className="spark-card p-4 flex flex-wrap items-center gap-2">
              <span className="label-mini mr-2">KIND</span>
              {(["all", "brand", "product", "playbook", "compliance"] as const).map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => setKindFilter(k)}
                    className={`chip ${
                      k === "all"
                        ? "chip-muted"
                        : k === "brand"
                          ? "chip-lime"
                          : k === "product"
                            ? "chip-sky"
                            : k === "playbook"
                              ? "chip-purple"
                              : "chip-orange"
                    }`}
                    style={
                      kindFilter === k
                        ? { outline: "1.5px solid currentColor" }
                        : undefined
                    }
                  >
                    {k === "all" ? "All" : KIND_LABEL[k as AcademyKind]}
                  </button>
                ),
              )}
              <span className="flex-1" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search modules…"
                className="rounded-xl text-xs"
                style={{
                  padding: "0.45rem 0.9rem",
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  maxWidth: 220,
                  outline: "none",
                }}
              />
            </div>

            {filtered.length === 0 ? (
              <div
                className="spark-card p-10 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {modules.length === 0
                  ? isAdmin
                    ? 'No modules yet. Build the first one — "Liquid Death · Brand 101" is a good start.'
                    : "Your Ignite RMM hasn't published any training modules yet."
                  : "No modules match these filters."}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((m) => (
                  <Card
                    key={m.id}
                    m={m}
                    onOpen={() =>
                      isAdmin
                        ? setEditingId(m.id)
                        : navigate(`/academy/${m.id}`)
                    }
                    isAdmin={isAdmin}
                    onDelete={() => {
                      if (!confirm(`Delete "${m.title}"?`)) return;
                      persist(modules.filter((x) => x.id !== m.id));
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {editing && (
          <Editor
            module={editing}
            onChange={(m) =>
              persist(modules.map((x) => (x.id === m.id ? m : x)))
            }
            onClose={() => setEditingId(null)}
          />
        )}
      </div>
    </Layout>
  );
}
