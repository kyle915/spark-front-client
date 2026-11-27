/**
 * Admin-Only Spark Help Knowledge Base & Unanswered Questions (Knowledge Gaps)
 * Console (`/help-knowledge`).
 *
 * Strictly restricted to Ignite admins (wrapped in `<AdminOnly>` at route level
 * AND verified server-side via DB-backed `is_ignite_admin_user`). Brand clients
 * can NEVER access this console or add/edit knowledge.
 */

import React, { Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Cpu,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import useSparkRole from "@/hooks/useSparkRole";
import { useAlertStore } from "@/store/alertStore";
import AiMarkdown from "@/components/ai/AiMarkdown";
import {
  DeleteSparkHelpArticleMutation,
  DismissSparkHelpGapMutation,
  ResolveSparkHelpGapMutation,
  SparkHelpKnowledgeQuery,
  SyncSparkHelpEmbeddingsMutation,
  UpsertSparkHelpArticleMutation,
} from "@/api/helpKnowledgeApi";
import type { helpKnowledgeApiQuery } from "@api/__generated__/helpKnowledgeApiQuery.graphql";
import type { helpKnowledgeApiUpsertArticleMutation } from "@api/__generated__/helpKnowledgeApiUpsertArticleMutation.graphql";
import type { helpKnowledgeApiDeleteArticleMutation } from "@api/__generated__/helpKnowledgeApiDeleteArticleMutation.graphql";
import type { helpKnowledgeApiResolveGapMutation } from "@api/__generated__/helpKnowledgeApiResolveGapMutation.graphql";
import type { helpKnowledgeApiDismissGapMutation } from "@api/__generated__/helpKnowledgeApiDismissGapMutation.graphql";
import type { helpKnowledgeApiSyncEmbeddingsMutation } from "@api/__generated__/helpKnowledgeApiSyncEmbeddingsMutation.graphql";
import { AskSparkHelpMutation } from "@/api/mutations/BrandChatMutations";
import type { BrandChatMutationsAskHelpMutation } from "@api/mutations/__generated__/BrandChatMutationsAskHelpMutation.graphql";
import {
  audienceBadgeMeta,
  confidenceBadgeMeta,
  HELP_AUDIENCE_OPTIONS,
  HELP_CATEGORY_OPTIONS,
  parseTagsInput,
  SPARK_ROUTE_PRESETS,
  type HelpAudience,
} from "./helpKnowledgeHelpers";

type ActiveTab = "gaps" | "articles" | "simulator";

const META = { color: "var(--spark-text-meta)" } as const;
const FIELD = {
  background: "var(--spark-bg)",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
} as const;

type DraftArticle = {
  uuid?: string;
  resolvingGapUuid?: string;
  resolvingGapQuestion?: string;
  title: string;
  body: string;
  category: string;
  audience: HelpAudience;
  routePath: string;
  routeLabel: string;
  tagsRaw: string;
};

const EMPTY_DRAFT: DraftArticle = {
  title: "",
  body: "",
  category: "general",
  audience: "all",
  routePath: "",
  routeLabel: "",
  tagsRaw: "",
};

const KnowledgeConsoleBody: React.FC<{
  fetchKey: number;
  onRefresh: () => void;
}> = ({ fetchKey, onRefresh }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [tab, setTab] = useState<ActiveTab>("gaps");
  const [gapStatus, setGapStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const [audienceFilter, setAudienceFilter] = useState<"" | HelpAudience>("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<DraftArticle | null>(null);

  // Simulator state (Preview as Brand Client vs Ignite Admin)
  const [simQuestion, setSimQuestion] = useState("");
  const [simRoute, setSimRoute] = useState("/demo-costs");
  const [simAsClient, setSimAsClient] = useState(true);
  const [simResult, setSimResult] = useState<
    BrandChatMutationsAskHelpMutation["response"]["askSparkHelp"] | null
  >(null);

  const data = useLazyLoadQuery<helpKnowledgeApiQuery>(
    SparkHelpKnowledgeQuery,
    {
      audience: audienceFilter || null,
      search: null,
      gapStatus,
    },
    { fetchPolicy: "store-and-network", fetchKey },
  );

  const kb = data.sparkHelpKnowledge;

  const [commitUpsert, savingArticle] =
    useMutation<helpKnowledgeApiUpsertArticleMutation>(UpsertSparkHelpArticleMutation);
  const [commitDelete, deletingArticle] =
    useMutation<helpKnowledgeApiDeleteArticleMutation>(DeleteSparkHelpArticleMutation);
  const [commitResolveGap, resolvingGap] =
    useMutation<helpKnowledgeApiResolveGapMutation>(ResolveSparkHelpGapMutation);
  const [commitDismissGap, dismissingGap] =
    useMutation<helpKnowledgeApiDismissGapMutation>(DismissSparkHelpGapMutation);
  const [commitSync, syncingEmbeddings] =
    useMutation<helpKnowledgeApiSyncEmbeddingsMutation>(SyncSparkHelpEmbeddingsMutation);
  const [commitAskHelp, runningSim] =
    useMutation<BrandChatMutationsAskHelpMutation>(AskSparkHelpMutation);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = kb.articles ?? [];
    if (!q) return list;
    return list.filter((a) =>
      [a.title, a.body, a.category, a.routePath, ...(a.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [kb.articles, search]);

  if (!kb.ok || !kb.isAdmin) {
    return (
      <div className="spark-card p-8 text-center space-y-2 max-w-xl">
        <p className="mono text-[10px] uppercase tracking-widest" style={META}>
          ADMIN ACCESS REQUIRED
        </p>
        <p className="text-sm font-semibold">
          {kb.reason || "Only Ignite admins can view or manage Spark Help Knowledge."}
        </p>
      </div>
    );
  }

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !editor.title.trim() || !editor.body.trim()) return;
    const tags = parseTagsInput(editor.tagsRaw);

    if (editor.resolvingGapUuid) {
      commitResolveGap({
        variables: {
          input: {
            gapUuid: editor.resolvingGapUuid,
            title: editor.title.trim(),
            body: editor.body.trim(),
            category: editor.category,
            audience: editor.audience,
            routePath: editor.routePath.trim(),
            routeLabel: editor.routeLabel.trim(),
            tags,
          },
        },
        onCompleted: (res) => {
          const r = res.resolveSparkHelpGap;
          if (!r.ok) {
            showAlert(r.reason || "Could not resolve knowledge gap.", "error");
            return;
          }
          showAlert("Gap answered & added to Spark Knowledge.", "success");
          setEditor(null);
          onRefresh();
        },
        onError: () => showAlert("Could not resolve knowledge gap.", "error"),
      });
      return;
    }

    commitUpsert({
      variables: {
        input: {
          uuid: editor.uuid || null,
          title: editor.title.trim(),
          body: editor.body.trim(),
          category: editor.category,
          audience: editor.audience,
          routePath: editor.routePath.trim(),
          routeLabel: editor.routeLabel.trim(),
          tags,
          sourceKind: "admin_faq",
          isActive: true,
        },
      },
      onCompleted: (res) => {
        const r = res.upsertSparkHelpArticle;
        if (!r.ok) {
          showAlert(r.reason || "Could not save article.", "error");
          return;
        }
        showAlert(
          r.article?.hasEmbedding
            ? "Saved & embedded with OpenAI text-embedding-3-small."
            : "Saved to Spark Knowledge.",
          "success",
        );
        setEditor(null);
        onRefresh();
      },
      onError: () => showAlert("Could not save article.", "error"),
    });
  };

  const handleDelete = (uuid: string, title: string) => {
    if (!window.confirm(`Delete "${title}" from Spark Knowledge?`)) return;
    commitDelete({
      variables: { uuid },
      onCompleted: (res) => {
        if (res.deleteSparkHelpArticle.ok) {
          showAlert("Article deleted.", "success");
          onRefresh();
        } else {
          showAlert(res.deleteSparkHelpArticle.reason || "Delete failed.", "error");
        }
      },
      onError: () => showAlert("Delete failed.", "error"),
    });
  };

  const handleDismissGap = (uuid: string) => {
    commitDismissGap({
      variables: { uuid },
      onCompleted: (res) => {
        if (res.dismissSparkHelpGap.ok) {
          showAlert("Gap dismissed.", "success");
          onRefresh();
        } else {
          showAlert(res.dismissSparkHelpGap.reason || "Dismiss failed.", "error");
        }
      },
      onError: () => showAlert("Dismiss failed.", "error"),
    });
  };

  const handleSyncEmbeddings = () => {
    commitSync({
      variables: {},
      onCompleted: (res) => {
        const r = res.syncSparkHelpEmbeddings;
        if (!r.ok) {
          showAlert(r.reason || "Sync failed.", "error");
          return;
        }
        showAlert(
          `Synced OpenAI embeddings (${r.articlesEmbedded} articles updated · ${r.builtinEmbedded} built-in docs ready).`,
          "success",
        );
        onRefresh();
      },
      onError: () => showAlert("Embedding sync failed.", "error"),
    });
  };

  const runSimulator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simQuestion.trim()) return;
    commitAskHelp({
      variables: {
        question: simQuestion.trim(),
        currentPath: simRoute || "/",
        tenantId: null,
        previewAsClient: simAsClient,
      },
      onCompleted: (res) => setSimResult(res.askSparkHelp),
      onError: () => showAlert("Simulator request failed.", "error"),
    });
  };

  const busySave = savingArticle || resolvingGap;

  return (
    <div className="space-y-6">
      <SparkPageHeader
        eyebrow="Ignite Admin · OpenAI Help Knowledge & Gaps"
        title="Spark Help Knowledge"
        support="Curate FAQs and internal SOPs, answer unanswered user questions, and sync OpenAI semantic embeddings (text-embedding-3-small). Brand clients can read client-safe answers in Ask Spark, never add knowledge."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncEmbeddings}
              disabled={syncingEmbeddings}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={FIELD}
            >
              <RefreshCw size={13} className={syncingEmbeddings ? "animate-spin" : ""} />
              {syncingEmbeddings ? "Syncing…" : "Sync OpenAI Embeddings"}
            </button>
            <button
              type="button"
              onClick={() => setEditor({ ...EMPTY_DRAFT })}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              <Plus size={14} />
              Add Knowledge Article
            </button>
          </div>
        }
      />

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="spark-card p-4 space-y-1">
          <p className="text-xs font-medium" style={META}>Open Knowledge Gaps</p>
          <p className="display text-3xl font-bold tab-num">{kb.openGapCount}</p>
          <p className="text-[11px]" style={META}>Unanswered or flagged questions</p>
        </div>
        <div className="spark-card p-4 space-y-1">
          <p className="text-xs font-medium" style={META}>Custom Admin Articles</p>
          <p className="display text-3xl font-bold tab-num">{kb.articles.length}</p>
          <p className="text-[11px]" style={META}>FAQs, SOPs &amp; Chat-taught entries</p>
        </div>
        <div className="spark-card p-4 space-y-1">
          <p className="text-xs font-medium" style={META}>Built-in Spark Docs</p>
          <p className="display text-3xl font-bold tab-num">{kb.builtinCount}</p>
          <p className="text-[11px]" style={META}>Audience-tagged client &amp; admin guides</p>
        </div>
        <div className="spark-card p-4 space-y-1">
          <p className="text-xs font-medium" style={META}>Semantic Embeddings</p>
          <p className="display text-3xl font-bold tab-num">{kb.embeddedCount}</p>
          <p className="text-[11px]" style={META}>OpenAI text-embedding-3-small</p>
        </div>
      </section>

      {/* Main Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="pill-group" role="tablist" aria-label="Help knowledge sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gaps"}
            onClick={() => setTab("gaps")}
            className={`pill-btn ${tab === "gaps" ? "on" : ""}`}
          >
            Knowledge Gaps ({kb.openGapCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "articles"}
            onClick={() => setTab("articles")}
            className={`pill-btn ${tab === "articles" ? "on" : ""}`}
          >
            Knowledge Base ({kb.articles.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "simulator"}
            onClick={() => setTab("simulator")}
            className={`pill-btn ${tab === "simulator" ? "on" : ""}`}
          >
            Test Client vs. Admin
          </button>
        </div>

        <Link
          to="/chat"
          className="text-xs font-semibold no-underline"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          Go to Spark Chat (/chat) →
        </Link>
      </div>

      {/* TAB 1: KNOWLEDGE GAPS */}
      {tab === "gaps" && (
        <section className="spark-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="display text-lg font-bold">
                Unanswered Questions &amp; Feedback Queue
              </h2>
              <p className="text-xs mt-0.5" style={META}>
                Logged automatically when Ask Spark has low confidence, a client clicks &ldquo;Not helpful&rdquo;, or a `/chat` AI draft spots missing SOP info.
              </p>
            </div>
            <div className="pill-group" role="group" aria-label="Filter gap status">
              {(["open", "resolved", "dismissed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setGapStatus(st)}
                  className={`pill-btn ${gapStatus === st ? "on" : ""}`}
                >
                  {st[0].toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {kb.gaps.length === 0 ? (
            <div className="rounded-xl p-8 text-center space-y-1.5" style={{ background: "var(--spark-surface-2)" }}>
              <CheckCircle2 size={20} className="mx-auto" style={{ color: "var(--spark-ok-ink, #2b4c08)" }} />
              <p className="text-sm font-semibold">No {gapStatus} knowledge gaps</p>
              <p className="text-xs" style={META}>
                Questions Spark can&apos;t confidently answer will show up here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {kb.gaps.map((g) => (
                <article
                  key={g.uuid}
                  className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mono"
                        style={
                          g.callerRole === "admin"
                            ? {
                                background: "rgba(210,72,27,0.10)",
                                color: "var(--spark-flag-ink, #a8340f)",
                              }
                            : {
                                background: "rgba(59,130,246,0.10)",
                                color: "#1d4ed8",
                              }
                        }
                      >
                        {g.callerRole === "admin" ? "Admin asked" : "Brand client asked"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] mono tab-num" style={FIELD}>
                        Asked {g.askedCount}×
                      </span>
                      {g.routePath ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] mono" style={FIELD}>
                          {g.routePath}
                        </span>
                      ) : null}
                      <span className="text-[11px]" style={META}>
                        {g.sourceSurface} · {g.reason}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">&ldquo;{g.question}&rdquo;</p>
                    {g.resolvedArticleTitle ? (
                      <p className="text-xs" style={{ color: "var(--spark-ok-ink, #2b4c08)" }}>
                        Resolved via article: <strong>{g.resolvedArticleTitle}</strong>
                      </p>
                    ) : null}
                  </div>

                  {g.status === "open" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditor({
                            resolvingGapUuid: g.uuid,
                            resolvingGapQuestion: g.question,
                            title: g.question.slice(0, 120),
                            body: "",
                            category: g.callerRole === "admin" ? "ba_ops" : "general",
                            audience: g.callerRole === "admin" ? "admin" : "all",
                            routePath: g.routePath || "",
                            routeLabel:
                              SPARK_ROUTE_PRESETS.find((p) => p.path === g.routePath)?.label || "",
                            tagsRaw: "",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        style={{
                          background: "var(--spark-lime)",
                          color: "var(--spark-on-accent)",
                        }}
                      >
                        <Sparkles size={12} />
                        Answer &amp; Teach Spark
                      </button>
                      <button
                        type="button"
                        disabled={dismissingGap}
                        onClick={() => handleDismissGap(g.uuid)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                        style={FIELD}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: KNOWLEDGE BASE ARTICLES */}
      {tab === "articles" && (
        <section className="spark-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="pill-group" role="group" aria-label="Filter articles by audience">
              {(
                [
                  ["", "All audiences"],
                  ["all", "Clients & Admins"],
                  ["client", "Brand Clients"],
                  ["admin", "Admin Only"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val || "any"}
                  type="button"
                  onClick={() => setAudienceFilter(val)}
                  className={`pill-btn ${audienceFilter === val ? "on" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 pointer-events-none" style={META} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, body, route…"
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs"
                style={FIELD}
              />
            </label>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="rounded-xl p-8 text-center space-y-2" style={{ background: "var(--spark-surface-2)" }}>
              <BookOpen size={20} className="mx-auto" style={META} />
              <p className="text-sm font-semibold">No custom articles yet</p>
              <p className="text-xs max-w-md mx-auto" style={META}>
                Built-in Spark docs ({kb.builtinCount}) already answer standard platform questions. Click &ldquo;Add Knowledge Article&rdquo; or use &ldquo;Teach Spark&rdquo; in /chat to add custom FAQs and internal SOPs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((art) => {
                const badge = audienceBadgeMeta(art.audience);
                return (
                  <article
                    key={art.uuid}
                    className="rounded-xl p-4 space-y-2"
                    style={{
                      background: "var(--spark-surface-2)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] mono inline-flex items-center gap-1"
                            style={FIELD}
                          >
                            <Cpu size={10} />
                            {art.hasEmbedding ? "Embedded" : "BM25 only"}
                          </span>
                          {art.routePath ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] mono" style={FIELD}>
                              {art.routePath}
                            </span>
                          ) : null}
                          <span className="text-[11px] tab-num" style={META}>
                            {art.usageCount} hits · {art.sourceKind.replace("_", " ")}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold">{art.title}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditor({
                              uuid: art.uuid,
                              title: art.title,
                              body: art.body,
                              category: art.category,
                              audience:
                                art.audience === "admin" || art.audience === "client"
                                  ? art.audience
                                  : "all",
                              routePath: art.routePath,
                              routeLabel: art.routeLabel,
                              tagsRaw: (art.tags || []).join(", "),
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          style={FIELD}
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingArticle}
                          onClick={() => handleDelete(art.uuid, art.title)}
                          aria-label={`Delete ${art.title}`}
                          className="p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                          style={{
                            ...FIELD,
                            color: "var(--spark-flag-ink, #a8340f)",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={META}>
                      {art.body}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: CLIENT VS ADMIN SIMULATOR */}
      {tab === "simulator" && (
        <section className="spark-card p-5 space-y-4">
          <div>
            <h2 className="display text-lg font-bold">
              Test Client vs. Admin Visibility
            </h2>
            <p className="text-xs mt-0.5" style={META}>
              Ask any question while toggling Brand Client vs. Ignite Admin scope to confirm internal SOPs (payroll, Wingspan, BA staffing, cron jobs) stay completely invisible to brand clients.
            </p>
          </div>

          <form onSubmit={runSimulator} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="pill-group" role="group" aria-label="Simulator audience">
                <button
                  type="button"
                  onClick={() => setSimAsClient(true)}
                  className={`pill-btn ${simAsClient ? "on" : ""}`}
                >
                  Preview as Brand Client
                </button>
                <button
                  type="button"
                  onClick={() => setSimAsClient(false)}
                  className={`pill-btn ${!simAsClient ? "on" : ""}`}
                >
                  Preview as Ignite Admin
                </button>
              </div>

              <select
                aria-label="Simulated current Spark route"
                value={simRoute}
                onChange={(e) => setSimRoute(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={FIELD}
              >
                {SPARK_ROUTE_PRESETS.filter((p) => p.path).map((p) => (
                  <option key={p.path} value={p.path}>
                    Page: {p.path}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={simQuestion}
                onChange={(e) => setSimQuestion(e.target.value)}
                placeholder="Try: 'How do BA Wingspan payments work?' or 'How does this page work?'"
                className="flex-1 rounded-lg px-3.5 py-2 text-sm"
                style={FIELD}
              />
              <button
                type="submit"
                disabled={runningSim || !simQuestion.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                {runningSim ? "Testing…" : "Test"}
              </button>
            </div>
          </form>

          {simResult ? (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold" style={FIELD}>
                  Scope: {simResult.isAdminScope ? "Ignite Admin" : "Brand Client (Safe)"}
                </span>
                {(() => {
                  const meta = confidenceBadgeMeta(simResult.confidence);
                  return (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {meta.label}
                    </span>
                  );
                })()}
                <span className="px-2 py-0.5 rounded-md text-[11px] mono" style={FIELD}>
                  {simResult.matchedVia === "hybrid" ? "Semantic + BM25" : "BM25"}
                </span>
              </div>
              <AiMarkdown links={false}>{simResult.answer}</AiMarkdown>
              {simResult.sources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {simResult.sources.map((s) => {
                    const ab = audienceBadgeMeta(s.audience);
                    return (
                      <span
                        key={`${s.title}-${s.routePath}`}
                        className="px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1.5"
                        style={FIELD}
                      >
                        <span className="font-medium">{s.title}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: ab.bg, color: ab.color }}
                        >
                          {ab.label}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      {/* Create / Edit / Resolve Gap Modal */}
      {editor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20, 22, 15, 0.48)" }}
          onClick={() => setEditor(null)}
        >
          <div
            role="dialog"
            aria-label={editor.resolvingGapUuid ? "Answer Knowledge Gap" : "Edit Help Knowledge Article"}
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
                <p className="mono text-[10px] uppercase tracking-widest" style={META}>
                  {editor.resolvingGapUuid
                    ? "ANSWER & TEACH SPARK"
                    : editor.uuid
                      ? "EDIT HELP ARTICLE"
                      : "NEW HELP ARTICLE"}
                </p>
                <h2 className="display text-xl font-bold mt-0.5">
                  {editor.resolvingGapUuid
                    ? "Resolve Knowledge Gap"
                    : editor.uuid
                      ? "Update Spark Knowledge"
                      : "Add to Spark Knowledge"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg"
                style={FIELD}
              >
                <X size={15} />
              </button>
            </div>

            {editor.resolvingGapQuestion ? (
              <div
                className="rounded-xl p-3 text-xs flex items-start gap-2"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" style={META} />
                <div>
                  <p className="font-semibold">Unanswered question:</p>
                  <p style={META}>&ldquo;{editor.resolvingGapQuestion}&rdquo;</p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSaveEditor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder="e.g. How to map unmatched Retailer POS store names"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={FIELD}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Audience</label>
                  <select
                    value={editor.audience}
                    onChange={(e) =>
                      setEditor({ ...editor, audience: e.target.value as HelpAudience })
                    }
                    className="w-full rounded-lg px-3 py-2 text-xs font-medium"
                    style={FIELD}
                  >
                    {HELP_AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select
                    value={editor.category}
                    onChange={(e) => setEditor({ ...editor, category: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-xs font-medium"
                    style={FIELD}
                  >
                    {HELP_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px]" style={META}>
                {HELP_AUDIENCE_OPTIONS.find((o) => o.value === editor.audience)?.description}
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">Answer / SOP body</label>
                <textarea
                  required
                  rows={5}
                  value={editor.body}
                  onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                  placeholder="Write clear, step-by-step instructions. Spark automatically generates an OpenAI embedding on save."
                  className="w-full rounded-lg px-3 py-2 text-sm leading-relaxed"
                  style={FIELD}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Linked Spark route</label>
                  <select
                    value={editor.routePath}
                    onChange={(e) => {
                      const next = e.target.value;
                      const preset = SPARK_ROUTE_PRESETS.find((p) => p.path === next);
                      setEditor({
                        ...editor,
                        routePath: next,
                        routeLabel: preset?.path ? preset.label : "",
                      });
                    }}
                    className="w-full rounded-lg px-3 py-2 text-xs"
                    style={FIELD}
                  >
                    {SPARK_ROUTE_PRESETS.map((p) => (
                      <option key={p.path || "none"} value={p.path}>
                        {p.path ? `${p.label} (${p.path})` : p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Search tags (comma separated)</label>
                  <input
                    type="text"
                    value={editor.tagsRaw}
                    onChange={(e) => setEditor({ ...editor, tagsRaw: e.target.value })}
                    placeholder="pos, matching, csv"
                    className="w-full rounded-lg px-3 py-2 text-xs"
                    style={FIELD}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold"
                  style={FIELD}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busySave || !editor.title.trim() || !editor.body.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  style={{
                    background: "var(--spark-lime)",
                    color: "var(--spark-on-accent)",
                  }}
                >
                  {busySave
                    ? "Saving & embedding…"
                    : editor.resolvingGapUuid
                      ? "Publish & Resolve Gap"
                      : "Save & Embed Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const SparkHelpKnowledgePage: React.FC = () => {
  const { isAdmin } = useSparkRole();
  const [fetchKey, setFetchKey] = useState(0);

  if (!isAdmin) return null;

  return (
    <Layout>
      <div className="max-w-6xl spark-scale">
        <Suspense
          fallback={
            <div className="spark-card p-8 text-sm" style={META}>
              Loading Spark Help Knowledge Base…
            </div>
          }
        >
          <KnowledgeConsoleBody
            fetchKey={fetchKey}
            onRefresh={() => setFetchKey((k) => k + 1)}
          />
        </Suspense>
      </div>
    </Layout>
  );
};

export default SparkHelpKnowledgePage;
