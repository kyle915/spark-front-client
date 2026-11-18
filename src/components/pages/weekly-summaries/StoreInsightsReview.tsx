import { useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAlertStore } from "@/store/alertStore";
import { BrandInsightReviewQuery } from "@/api/queries/BrandInsightReviewQuery";
import type { BrandInsightReviewQuery as ReviewQueryType } from "@api/queries/__generated__/BrandInsightReviewQuery.graphql";
import {
  GenerateBrandInsightsMutation,
  PublishBrandInsightsMutation,
  SetBrandInsightStatusMutation,
} from "@/api/mutations/BrandInsightMutations";
import type { BrandInsightMutationsGenerateMutation } from "@api/mutations/__generated__/BrandInsightMutationsGenerateMutation.graphql";
import type { BrandInsightMutationsPublishMutation } from "@api/mutations/__generated__/BrandInsightMutationsPublishMutation.graphql";
import type { BrandInsightMutationsStatusMutation } from "@api/mutations/__generated__/BrandInsightMutationsStatusMutation.graphql";
import { insightLabel, insightStatusLine } from "@/lib/storeInsights";

/**
 * Store recommendations and alerts, for Ignite staff to publish. A daily
 * job works them out from approved recaps and stores them as drafts; a
 * brand sees one only once it is published here. Publishing shows it on
 * the brand's dashboard and sends nothing.
 */

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

type Brand = NonNullable<ReviewQueryType["response"]["brandInsightReview"]>[number];
type Item = Brand["items"][number];

const ItemRow: React.FC<{
  item: Item;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
}> = ({ item, busy, onStatus }) => {
  const [open, setOpen] = useState(false);
  const draft = item.status === "draft";
  return (
    <li className="py-3" style={{ borderTop: "1px solid var(--spark-border)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold" style={SECONDARY}>
          {item.kind === "alert" ? "Alert" : "Recommendation"} · {insightLabel(item.code)}
        </p>
        <p className="text-xs" style={draft ? META : SECONDARY}>
          {insightStatusLine(item)}
        </p>
      </div>
      <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--spark-text)" }}>
        {item.text}
      </p>
      {open ? (
        <div className="mt-2 rounded-xl px-3 py-2" style={{ background: "var(--spark-field-bg)" }}>
          <p className="text-xs whitespace-pre-line" style={SECONDARY}>
            {item.factsText}
          </p>
          {item.source === "model" ? (
            <p className="text-xs mt-2" style={META}>
              Built in code: {item.template}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {item.status !== "published" ? (
          <button type="button" className="spark-btn-ghost" disabled={busy} onClick={() => onStatus(item.id, "published")}>
            Publish
          </button>
        ) : null}
        {item.status !== "hidden" ? (
          <button type="button" className="spark-btn-ghost" disabled={busy} onClick={() => onStatus(item.id, "hidden")}>
            Hide
          </button>
        ) : null}
        {item.status !== "draft" ? (
          <button type="button" className="spark-btn-ghost" disabled={busy} onClick={() => onStatus(item.id, "draft")}>
            Back to draft
          </button>
        ) : null}
        <button type="button" className="spark-btn-ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide the numbers" : "Show the numbers"}
        </button>
      </div>
    </li>
  );
};

const BrandBlock: React.FC<{ brand: Brand; first: boolean; onChanged: () => void }> = ({
  brand,
  first,
  onChanged,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [items, setItems] = useState<readonly Item[]>(brand.items);
  const [problem, setProblem] = useState<string | null>(null);
  const [publish, publishing] = useMutation<BrandInsightMutationsPublishMutation>(PublishBrandInsightsMutation);
  const [setStatus, saving] = useMutation<BrandInsightMutationsStatusMutation>(SetBrandInsightStatusMutation);
  const [generate, generating] = useMutation<BrandInsightMutationsGenerateMutation>(GenerateBrandInsightsMutation);
  const busy = publishing || saving || generating;
  const drafts = items.filter((i) => i.status === "draft");

  const publishAll = () => {
    if (busy || !drafts.length) return;
    publish({
      variables: { tenantId: brand.tenantId, ids: drafts.map((d) => d.id) },
      onCompleted: (res) => {
        const result = res.publishBrandInsights;
        if (!result.ok) {
          setProblem(result.reason || "That could not be saved.");
          return;
        }
        setProblem(null);
        setItems((prev) => prev.map((i) => (i.status === "draft" ? { ...i, status: "published" } : i)));
        showAlert(`Published ${result.count}.`, "success");
        onChanged();
      },
      onError: () => setProblem("That could not be saved."),
    });
  };

  const changeStatus = (id: string, status: string) => {
    if (busy) return;
    setStatus({
      variables: { id, status },
      onCompleted: (res) => {
        const result = res.setBrandInsightStatus;
        if (!result.ok || !result.item) {
          setProblem(result.reason || "That could not be saved.");
          return;
        }
        setProblem(null);
        const next = result.item;
        setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
      },
      onError: () => setProblem("That could not be saved."),
    });
  };

  const rerun = () => {
    if (busy) return;
    generate({
      variables: { tenantId: brand.tenantId },
      onCompleted: (res) => {
        const result = res.generateBrandInsights;
        if (!result.ok) {
          setProblem(result.reason || "Findings could not be worked out right now.");
          return;
        }
        setProblem(null);
        showAlert(result.count ? `${result.count} new or changed.` : "Nothing new.", "success");
        onChanged();
      },
      onError: () => setProblem("Findings could not be worked out right now."),
    });
  };

  return (
    <li className="py-6 first:pt-0 last:pb-0" style={first ? undefined : { borderTop: "1px solid var(--spark-border)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-base font-semibold" style={{ color: "var(--spark-text)" }}>
          {brand.tenantName}
        </h2>
        <p className="text-xs" style={drafts.length ? SECONDARY : META}>
          {drafts.length ? `${drafts.length} to review` : "Nothing to review"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {drafts.length ? (
          <button type="button" className="spark-btn-primary" onClick={publishAll} disabled={busy}>
            {publishing ? "Publishing" : `Publish all ${drafts.length}`}
          </button>
        ) : null}
        <button type="button" className="spark-btn-ghost" onClick={rerun} disabled={busy}>
          {generating ? "Working it out" : "Work out again"}
        </button>
      </div>
      <ul className="m-0 p-0 list-none mt-3">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} busy={busy} onStatus={changeStatus} />
        ))}
      </ul>
      {problem ? (
        <p className="text-sm mt-2" role="status" style={{ color: "var(--spark-orange)" }}>
          {problem}
        </p>
      ) : null}
    </li>
  );
};

const StoreInsightsReview: React.FC = () => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ReviewQueryType>(
    BrandInsightReviewQuery,
    {},
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const brands = data.brandInsightReview;
  if (!brands) {
    return (
      <p className="text-sm" style={META}>
        Store insights are for Ignite staff.
      </p>
    );
  }
  return (
    <section className="spark-card p-5 sm:p-6">
      {brands.length === 0 ? (
        <p className="text-sm" style={META}>
          No brand has a store recommendation or alert right now.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {brands.map((brand, i) => (
            <BrandBlock
              key={`${brand.tenantId}|${fetchKey}`}
              brand={brand}
              first={i === 0}
              onChanged={() => setFetchKey((k) => k + 1)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default StoreInsightsReview;
