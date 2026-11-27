/**
 * Interactive Spark Setup & Feature Guide (`/setup-guide`).
 *
 * Step-by-step playbook built directly into Spark covering:
 *  - Interactive Sample Brand Sandbox (`/sandbox`)
 *  - Shelf Compliance, Pricing & Competitor Voice (`/shelf-voice`)
 *  - One-Click Retail Buyer QBR Decks (`/buyer-report?deck=1`)
 *  - Saved Report Views & Automated Friday Digests
 *  - Outbound Webhooks (`recap.approved`, `request.created`, `shelf.oos_detected`)
 *  - AI Connector (Claude & ChatGPT via Spark MCP)
 *
 * Live-detects configured Saved Views and active Webhooks for the active brand
 * workspace, supports per-workspace progress checkboxes, keyword search, and
 * 1-click copyable JSON/HMAC snippets.
 */

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import {
  SavedReportViewsQuery,
  WorkspaceWebhooksQuery,
} from "@/api/queries/SavedViewsWebhooksQueries";
import type { SavedViewsWebhooksQueriesSavedReportViewsQuery as ViewsQueryType } from "@/api/queries/__generated__/SavedViewsWebhooksQueriesSavedReportViewsQuery.graphql";
import type { SavedViewsWebhooksQueriesWorkspaceWebhooksQuery as WebhooksQueryType } from "@/api/queries/__generated__/SavedViewsWebhooksQueriesWorkspaceWebhooksQuery.graphql";
import {
  computeSetupGuideProgress,
  filterSetupGuideTracks,
  SETUP_GUIDE_TRACKS,
  setupGuideStorageKey,
  type SetupGuideCategory,
  type SetupGuideTrack,
} from "./setupGuideData";

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const OK_PILL = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

type LiveStatusMap = {
  savedViewsCount: number;
  scheduledViewsCount: number;
  activeWebhooksCount: number;
};

function readCompleted(tenantId: string | number | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(setupGuideStorageKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCompleted(
  tenantId: string | number | null | undefined,
  ids: string[],
): void {
  try {
    localStorage.setItem(setupGuideStorageKey(tenantId), JSON.stringify(ids));
  } catch {
    /* ignore storage quota errors */
  }
}

const CopyCodeBlock: React.FC<{
  label: string;
  code: string;
}> = ({ label, code }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--spark-border)" }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
        style={{
          background: "var(--spark-surface-2)",
          borderBottom: "1px solid var(--spark-border)",
        }}
      >
        <span className="font-semibold inline-flex items-center gap-1.5">
          <Terminal size={12} style={META} />
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          style={FIELD}
        >
          <Copy size={11} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="p-3 text-[11px] leading-relaxed overflow-x-auto m-0 mono"
        style={{ background: "#14160f", color: "#f2f3ee" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

const LiveWorkspaceSignals: React.FC<{
  tenantId: string;
  onStatus: (s: LiveStatusMap) => void;
}> = ({ tenantId, onStatus }) => {
  const viewsData = useLazyLoadQuery<ViewsQueryType>(
    SavedReportViewsQuery,
    { surface: null, tenantId },
    { fetchPolicy: "store-and-network", fetchKey: `guide-views:${tenantId}` },
  );
  const webhooksData = useLazyLoadQuery<WebhooksQueryType>(
    WorkspaceWebhooksQuery,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey: `guide-webhooks:${tenantId}` },
  );

  const views = viewsData?.savedReportViews ?? [];
  const endpoints = webhooksData?.workspaceWebhooks?.endpoints ?? [];

  const savedViewsCount = views.length;
  const scheduledViewsCount = views.filter((v) => v.scheduleEnabled).length;
  const activeWebhooksCount = endpoints.filter((e) => e.isActive).length;

  useEffect(() => {
    onStatus({ savedViewsCount, scheduledViewsCount, activeWebhooksCount });
  }, [savedViewsCount, scheduledViewsCount, activeWebhooksCount, onStatus]);

  return null;
};

const TrackCard: React.FC<{
  track: SetupGuideTrack;
  isDone: boolean;
  liveBadge: string | null;
  isAdmin: boolean;
  defaultOpen: boolean;
  onToggleDone: () => void;
}> = ({ track, isDone, liveBadge, isAdmin, defaultOpen, onToggleDone }) => {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <article
      id={track.id}
      className="spark-card p-5 space-y-4 scroll-mt-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={isDone}
            aria-label={
              isDone
                ? `Mark ${track.title} as not done`
                : `Mark ${track.title} complete`
            }
            className="mt-1 w-6 h-6 rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
            style={
              isDone
                ? {
                    background: "var(--spark-ok-ink)",
                    color: "#ffffff",
                    border: "1px solid var(--spark-ok-ink)",
                  }
                : {
                    background: "var(--spark-surface)",
                    color: "transparent",
                    ...BORDER,
                  }
            }
          >
            <Check size={13} strokeWidth={2.75} />
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-[10px] uppercase tracking-wider" style={META}>
                {track.eyebrow}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] tab-num"
                style={META}
              >
                <Clock size={11} /> {track.estimatedMinutes} min
              </span>
              {liveBadge ? (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1"
                  style={OK_PILL}
                >
                  <CheckCircle2 size={10} />
                  {liveBadge}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-left cursor-pointer block"
            >
              <h2 className="display text-lg font-bold leading-snug">
                {track.title}
              </h2>
            </button>
            <p className="text-xs sm:text-sm leading-relaxed" style={SECONDARY}>
              {track.summary}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 pl-9 sm:pl-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={FIELD}
          >
            {open ? "Hide steps" : "View steps"}
          </button>
          <Link
            to={track.primaryTo}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 no-underline"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
          >
            {track.primaryLabel}
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {open && (
        <div
          className="pt-4 space-y-4"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <ol className="space-y-3 m-0 p-0 list-none">
            {track.steps.map((step, idx) => (
              <li
                key={step.title}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-3.5"
                style={{ background: "var(--spark-surface-2)", ...BORDER }}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className="mono w-6 h-6 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center"
                    style={{
                      background: "var(--spark-surface)",
                      color: "var(--spark-text)",
                      ...BORDER,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs leading-relaxed" style={META}>
                      {step.detail}
                    </p>
                  </div>
                </div>
                {step.to && step.ctaLabel ? (
                  <Link
                    to={step.to}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 no-underline"
                    style={FIELD}
                  >
                    {step.ctaLabel}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>

          {track.tips && track.tips.length > 0 && (
            <div
              className="rounded-xl p-3.5 space-y-1 text-xs"
              style={{
                background: "var(--spark-ok-bg)",
                color: "var(--spark-ok-ink)",
                border: "1px solid var(--spark-ok-border)",
              }}
            >
              {track.tips.map((tip) => (
                <p key={tip} className="m-0 leading-relaxed">
                  <strong>Tip:</strong> {tip}
                </p>
              ))}
            </div>
          )}

          {track.snippets && track.snippets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {track.snippets.map((sn) => (
                <CopyCodeBlock key={sn.label} label={sn.label} code={sn.code} />
              ))}
            </div>
          )}

          {isAdmin && track.adminOnlyNote && (
            <div
              className="rounded-xl p-4 space-y-2.5 text-xs"
              style={{ background: "var(--spark-surface-2)", ...BORDER }}
            >
              <p className="font-bold">{track.adminOnlyNote.title}</p>
              <p style={META}>{track.adminOnlyNote.body}</p>
              {track.adminOnlyNote.code ? (
                <CopyCodeBlock
                  label="Cloud Scheduler endpoint"
                  code={track.adminOnlyNote.code}
                />
              ) : null}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggleDone}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              style={isDone ? OK_PILL : FIELD}
            >
              <Check size={13} />
              {isDone ? "Marked complete" : "Mark this guide complete"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export const SparkSetupGuide: React.FC = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { isAdmin } = useSparkRole();
  const location = useLocation();
  const hashTarget = location.hash.replace(/^#/, "");

  const [category, setCategory] = useState<SetupGuideCategory>("all");
  const [query, setQuery] = useState("");
  const [manualCompleted, setManualCompleted] = useState<string[]>(() =>
    readCompleted(tenantId),
  );
  const [liveStatus, setLiveStatus] = useState<LiveStatusMap>({
    savedViewsCount: 0,
    scheduledViewsCount: 0,
    activeWebhooksCount: 0,
  });

  useEffect(() => {
    setManualCompleted(readCompleted(tenantId));
  }, [tenantId]);

  const effectiveCompleted = useMemo(() => {
    const set = new Set(manualCompleted);
    if (liveStatus.savedViewsCount > 0) set.add("saved-views");
    if (liveStatus.activeWebhooksCount > 0) set.add("webhooks");
    return set;
  }, [manualCompleted, liveStatus]);

  const progress = useMemo(
    () => computeSetupGuideProgress(SETUP_GUIDE_TRACKS, effectiveCompleted),
    [effectiveCompleted],
  );

  const visibleTracks = useMemo(
    () => filterSetupGuideTracks(SETUP_GUIDE_TRACKS, category, query),
    [category, query],
  );

  const toggleTrack = (id: string) => {
    setManualCompleted((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      writeCompleted(tenantId, next);
      return next;
    });
  };

  const liveBadgeFor = (id: string): string | null => {
    if (id === "saved-views" && liveStatus.savedViewsCount > 0) {
      return liveStatus.scheduledViewsCount > 0
        ? `${liveStatus.savedViewsCount} saved · ${liveStatus.scheduledViewsCount} scheduled`
        : `${liveStatus.savedViewsCount} saved view${liveStatus.savedViewsCount === 1 ? "" : "s"}`;
    }
    if (id === "webhooks" && liveStatus.activeWebhooksCount > 0) {
      return `${liveStatus.activeWebhooksCount} active endpoint${liveStatus.activeWebhooksCount === 1 ? "" : "s"}`;
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl spark-scale">
        {tenantId ? (
          <Suspense fallback={null}>
            <LiveWorkspaceSignals
              key={String(tenantId)}
              tenantId={String(tenantId)}
              onStatus={setLiveStatus}
            />
          </Suspense>
        ) : null}

        <SparkPageHeader
          eyebrow="Workspace Playbook · Interactive Setup Guide"
          title="Set up your Spark stack"
          support="Step-by-step walkthroughs for Shelf & Voice, Buyer QBR Decks, Friday Saved-View Digests, Outbound Webhooks, Spark MCP, and the Sample Brand Sandbox."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/sandbox"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 no-underline"
                style={FIELD}
              >
                <Sparkles size={13} />
                Open Sandbox
              </Link>
              <Link
                to="/help"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 no-underline"
                style={FIELD}
              >
                <BookOpen size={13} />
                Help &amp; Support
              </Link>
            </div>
          }
        />

        {/* Progress & Filter Strip */}
        <section className="spark-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold tab-num">
                Workspace readiness: {progress.done} of {progress.total} guides
                complete ({progress.pct}%)
              </p>
              <p className="text-xs mt-0.5" style={META}>
                Saved Views and Outbound Webhooks auto-check once configured in
                this workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="pill-group" role="group" aria-label="Filter setup tracks">
                {(
                  [
                    ["all", "All guides"],
                    ["brand", "Brand & Reporting"],
                    ["integrations", "Webhooks & AI"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCategory(k)}
                    className={`pill-btn ${category === k ? "on" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="relative flex items-center">
                <Search
                  size={13}
                  className="absolute left-2.5 pointer-events-none"
                  style={META}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Zapier, MSRP, Friday…"
                  className="pl-8 pr-3 py-1.5 rounded-lg text-xs"
                  style={FIELD}
                />
              </label>
            </div>
          </div>

          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: "var(--spark-surface-2)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress.pct}%`,
                background: "var(--spark-ok-ink)",
              }}
            />
          </div>

          {/* Quick-jump TOC pills */}
          <div className="flex flex-wrap gap-1.5">
            {SETUP_GUIDE_TRACKS.map((t, i) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="px-2.5 py-1 rounded-full text-xs font-medium no-underline inline-flex items-center gap-1.5"
                style={
                  effectiveCompleted.has(t.id)
                    ? OK_PILL
                    : {
                        background: "var(--spark-surface-2)",
                        color: "var(--spark-text)",
                        ...BORDER,
                      }
                }
              >
                <span className="mono text-[10px]">{i + 1}.</span>
                <span>{t.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Track Cards */}
        <div className="space-y-4">
          {visibleTracks.length === 0 ? (
            <div className="spark-card p-6 text-sm" style={META}>
              No setup tracks matched “{query}”. Try searching for “Zapier”,
              “MSRP”, “Friday”, “PowerPoint”, or “Claude”.
            </div>
          ) : (
            visibleTracks.map((track, idx) => (
              <TrackCard
                key={track.id}
                track={track}
                isDone={effectiveCompleted.has(track.id)}
                liveBadge={liveBadgeFor(track.id)}
                isAdmin={isAdmin}
                defaultOpen={
                  hashTarget ? hashTarget === track.id : idx === 0
                }
                onToggleDone={() => toggleTrack(track.id)}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SparkSetupGuide;
