import { Component, Suspense, useState, type ReactNode } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import type { BaProductNotesCardQuery as QueryType } from "./__generated__/BaProductNotesCardQuery.graphql";
import type { BaProductNotesCardSaveMutation as SaveType } from "./__generated__/BaProductNotesCardSaveMutation.graphql";
import type { BaProductNotesCardWebsiteMutation as WebsiteType } from "./__generated__/BaProductNotesCardWebsiteMutation.graphql";
import type { BaProductNotesCardRefreshMutation as RefreshType } from "./__generated__/BaProductNotesCardRefreshMutation.graphql";
import type { BaProductNotesCardExcludeMutation as ExcludeType } from "./__generated__/BaProductNotesCardExcludeMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { askedWhen, outcomeLabel, sortSources, sourceStatus, sourcesSummary } from "./baProductNotes";

const Query = graphql`
  query BaProductNotesCardQuery($tenantId: ID!) {
    baProductQa(tenantId: $tenantId) {
      notes
      hasMaterial
      aiAvailable
      websiteUrl
      websitePages
      websiteProducts
      documentCount
      websiteRefreshedAt
      websiteRefreshMessage
      documentsRefreshedAt
      sources {
        id
        kind
        kindLabel
        title
        url
        label
        status
        error
        excluded
        chars
        checkedAt
      }
      questions {
        question
        answer
        outcome
        askedAt
        eventName
        source
      }
    }
  }
`;

const SaveMutation = graphql`
  mutation BaProductNotesCardSaveMutation($tenantId: ID!, $notes: String!) {
    setBaProductNotes(tenantId: $tenantId, notes: $notes) {
      notes
      hasMaterial
      aiAvailable
      websiteUrl
      websitePages
      websiteProducts
      documentCount
      websiteRefreshedAt
      websiteRefreshMessage
      documentsRefreshedAt
      sources {
        id
        kind
        kindLabel
        title
        url
        label
        status
        error
        excluded
        chars
        checkedAt
      }
      questions {
        question
        answer
        outcome
        askedAt
        eventName
        source
      }
    }
  }
`;

const WebsiteMutation = graphql`
  mutation BaProductNotesCardWebsiteMutation($tenantId: ID!, $url: String!) {
    setBaBrandWebsite(tenantId: $tenantId, url: $url) {
      websiteUrl
      websitePages
      websiteProducts
      sources {
        id
      }
    }
  }
`;

const RefreshMutation = graphql`
  mutation BaProductNotesCardRefreshMutation($tenantId: ID!) {
    refreshBaProductSources(tenantId: $tenantId, scope: "all") {
      websitePages
      websiteProducts
      documentCount
      websiteRefreshedAt
      websiteRefreshMessage
      documentsRefreshedAt
    }
  }
`;

const ExcludeMutation = graphql`
  mutation BaProductNotesCardExcludeMutation($tenantId: ID!, $sourceId: ID!, $excluded: Boolean!) {
    setBaProductSourceExcluded(tenantId: $tenantId, sourceId: $sourceId, excluded: $excluded) {
      websitePages
      sources {
        id
        excluded
      }
    }
  }
`;

const NOTES_MAX = 8000;
const SOURCES_PREVIEW = 8;
const fieldStyle = {
  padding: "0.55rem 0.9rem",
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
  outline: "none",
} as const;
const quietButton = {
  border: "1px solid var(--spark-border)",
  background: "transparent",
  color: "var(--spark-text)",
} as const;
const meta = { color: "var(--spark-text-meta)" } as const;

const Body: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    Query,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const qa = data.baProductQa;
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState<string | null>(null);
  const [commit, saving] = useMutation<SaveType>(SaveMutation);
  const [commitSite, savingSite] = useMutation<WebsiteType>(WebsiteMutation);
  const [commitRefresh, refreshing] = useMutation<RefreshType>(RefreshMutation);
  const [commitExclude, excluding] = useMutation<ExcludeType>(ExcludeMutation);
  const [siteDraft, setSiteDraft] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!qa) return null;
  const value = draft ?? qa.notes;
  const dirty = draft !== null && draft.trim() !== qa.notes.trim();
  const siteValue = siteDraft ?? qa.websiteUrl;
  const siteDirty = siteDraft !== null && siteDraft.trim() !== qa.websiteUrl;
  const sources = sortSources(qa.sources);
  const shown = showAll ? sources : sources.slice(0, SOURCES_PREVIEW);
  const reload = () => setFetchKey((k) => k + 1);
  const fail = (errors: readonly { message: string }[] | null | undefined) => {
    if (errors?.length) {
      showAlert(errors[0].message, "error");
      return true;
    }
    return false;
  };

  const saveSite = () => {
    commitSite({
      variables: { tenantId, url: siteValue.trim() },
      onCompleted: (resp, errors) => {
        if (fail(errors)) return;
        setSiteDraft(null);
        reload();
        showAlert(
          resp.setBaBrandWebsite.websiteUrl
            ? "Website saved. Press Refresh now to read it."
            : "Website removed.",
          "success",
        );
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const refresh = () => {
    commitRefresh({
      variables: { tenantId },
      onCompleted: (resp, errors) => {
        if (fail(errors)) return;
        reload();
        const r = resp.refreshBaProductSources;
        showAlert(
          r.websiteRefreshMessage ||
            `Refreshed: ${r.websitePages} pages, ${r.websiteProducts} products, ${r.documentCount} documents.`,
          r.websiteRefreshMessage ? "error" : "success",
        );
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const toggle = (sourceId: string, excluded: boolean) => {
    commitExclude({
      variables: { tenantId, sourceId, excluded },
      onCompleted: (_resp, errors) => {
        if (fail(errors)) return;
        reload();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const save = () => {
    commit({
      variables: { tenantId, notes: value },
      onCompleted: (_resp, errors) => {
        if (errors?.length) {
          showAlert(errors[0].message, "error");
          return;
        }
        setDraft(null);
        setFetchKey((k) => k + 1);
        showAlert("Product notes saved.", "success");
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  return (
    <section className="spark-card p-4 mb-5" aria-label="BA product notes">
      <h3 className="font-semibold text-sm">BA product notes</h3>
      <p className="text-xs mt-1 mb-3" style={{ ...meta, lineHeight: 1.5 }}>
        Ambassadors can ask product questions on the check-in page. Answers come only from these
        notes, this brand's product list, its training hub, the documents uploaded for it and its
        website. Write the facts a BA gets asked at the table: ingredients, caffeine, ABV or THC per
        serving, sizes, what not to say. When the notes and the website disagree, the notes win.
      </p>
      <textarea
        value={value}
        disabled={saving}
        maxLength={NOTES_MAX}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        placeholder={"OG Luxe: 100mg caffeine per 12oz can, 10 calories.\nDon't describe health benefits — say \"check the can\"."}
        className="rounded-xl text-sm w-full"
        style={{
          ...fieldStyle,
          resize: "vertical",
          minHeight: 140,
          opacity: saving ? 0.6 : 1,
        }}
      />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            opacity: saving || !dirty ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
        <span className="text-xs" style={meta}>
          {value.length.toLocaleString()} / {NOTES_MAX.toLocaleString()}
          {qa.aiAvailable ? "" : " · AI is not configured, so BAs see “not available right now”"}
        </span>
      </div>

      <h4 className="font-semibold text-sm mt-5">Brand website</h4>
      <p className="text-xs mt-1 mb-2" style={{ ...meta, lineHeight: 1.5 }}>
        Spark reads up to 25 product, FAQ, about and nutrition pages on this site once a week
        (Shopify product data too), and only pages on the brand's own site.
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (siteDirty && !savingSite) saveSite();
        }}
      >
        <label htmlFor="ba-brand-website" className="sr-only">
          Brand website
        </label>
        <input
          id="ba-brand-website"
          type="url"
          inputMode="url"
          value={siteValue}
          disabled={savingSite}
          onChange={(e) => setSiteDraft(e.target.value)}
          placeholder="https://brand.com"
          className="rounded-xl text-sm"
          style={{ ...fieldStyle, flex: "1 1 220px", minWidth: 0 }}
        />
        <button
          type="submit"
          disabled={savingSite || !siteDirty}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ ...quietButton, opacity: savingSite || !siteDirty ? 0.5 : 1 }}
        >
          {savingSite ? "Saving…" : "Save website"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
        <h4 className="font-semibold text-sm m-0">Sources BAs' answers come from</h4>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ ...quietButton, opacity: refreshing ? 0.6 : 1 }}
        >
          {refreshing ? "Refreshing… up to a minute" : "Refresh now"}
        </button>
      </div>
      <p className="text-xs mt-1" style={meta}>
        {sourcesSummary(
          "Website",
          [
            [qa.websitePages, "page", "pages"],
            [qa.websiteProducts, "product", "products"],
          ],
          qa.websiteRefreshedAt,
        )}
      </p>
      {qa.websiteRefreshMessage ? (
        <p className="text-xs mt-0.5" style={{ color: "var(--spark-danger)" }}>
          Last website refresh: {qa.websiteRefreshMessage}
        </p>
      ) : null}
      <p className="text-xs mt-0.5" style={meta}>
        {sourcesSummary("Documents", [[qa.documentCount, "document", "documents"]], qa.documentsRefreshedAt)}
      </p>
      {sources.length === 0 ? (
        <p className="text-xs mt-2" style={meta}>
          Nothing read yet. Add the website or upload a PDF to the training hub, then press Refresh
          now.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 mt-2">
          {shown.map((src) => {
            const status = sourceStatus(src);
            return (
              <li
                key={src.id}
                className="py-2 text-sm flex items-start justify-between gap-3"
                style={{ borderTop: "1px solid var(--spark-hairline)", opacity: src.excluded ? 0.55 : 1 }}
              >
                <span className="min-w-0">
                  <span className="block" style={{ overflowWrap: "anywhere" }}>
                    {src.title || src.label.replace(/^From /, "")}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ ...meta, overflowWrap: "anywhere" }}>
                    {[
                      src.kindLabel,
                      src.label.replace(/^From /, "") !== src.title ? src.label.replace(/^From /, "") : "",
                      status,
                      src.checkedAt ? `checked ${askedWhen(src.checkedAt)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={excluding}
                  onClick={() => toggle(src.id, !src.excluded)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                  style={quietButton}
                  aria-label={`${src.excluded ? "Include" : "Exclude"} ${src.title || src.label}`}
                >
                  {src.excluded ? "Include" : "Exclude"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sources.length > SOURCES_PREVIEW ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-semibold mt-1"
          style={{ background: "none", border: 0, padding: 0, color: "var(--spark-text)" }}
        >
          {showAll ? "Show fewer" : `Show all ${sources.length}`}
        </button>
      ) : null}

      <h4 className="font-semibold text-sm mt-5">Recent questions from BAs</h4>
      {qa.questions.length === 0 ? (
        <p className="text-xs mt-1" style={meta}>
          No questions yet.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 mt-1">
          {qa.questions.map((q, i) => (
            <li
              key={`${q.askedAt}-${i}`}
              className="py-2 text-sm"
              style={{ borderTop: "1px solid var(--spark-hairline)" }}
            >
              <span className="block">{q.question}</span>
              <span className="block text-xs mt-0.5" style={meta}>
                {[outcomeLabel(q.outcome), askedWhen(q.askedAt), q.eventName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {q.outcome === "answered" ? (
                <span className="block text-xs mt-0.5" style={meta}>
                  {q.answer}
                  {q.source ? ` (${q.source})` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Staff tooling must never take the Walk-ups page down with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Staff-only: the facts BAs' product questions are answered from — notes,
 * the brand website and uploaded documents — and what BAs have been asking
 * (spark-api `baProductQa`, `setBaProductNotes`, `setBaBrandWebsite`,
 * `refreshBaProductSources`, `setBaProductSourceExcluded`).
 */
const BaProductNotesCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  if (!isAdmin || !tenantId) return null;
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Body tenantId={String(tenantId)} />
      </Suspense>
    </Quiet>
  );
};

export default BaProductNotesCard;
