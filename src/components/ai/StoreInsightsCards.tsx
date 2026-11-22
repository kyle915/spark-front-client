import React, { Suspense, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TenantStoreInsightsQuery } from "@/api/queries/TenantStoreInsightsQuery";
import { PilotMutationsCreateStoreActionMutation } from "@/api/mutations/PilotMutations";
import type { TenantStoreInsightsQuery as QueryType } from "@api/queries/__generated__/TenantStoreInsightsQuery.graphql";
import type { PilotMutationsCreateStoreActionMutation as CreateActionMutationType } from "@/api/mutations/__generated__/PilotMutationsCreateStoreActionMutation.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import { groupRecommendations, visibleInsights } from "@/lib/storeInsights";
import { storeActionLabel, type StoreActionTypeKind } from "@/pilot/pilotHelpers";

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;

type Insights = NonNullable<QueryType["response"]["tenantStoreInsights"]>;
type Item = Insights["recommendations"][number];
type AlertItem = Insights["alerts"][number];

const DraftNote: React.FC = () => (
  <p className="text-xs mt-4" style={META}>
    Includes drafts. The brand sees a finding only once it is published.{" "}
    <Link to="/weekly-summaries?view=insights" className="underline underline-offset-2">
      Review them
    </Link>
  </p>
);

const RecommendationActionDrawer: React.FC<{
  item: Item;
  initialAction: StoreActionTypeKind;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, initialAction, onClose, onSaved }) => {
  const [actionType, setActionType] =
    useState<StoreActionTypeKind>(initialAction);
  const [selectedStoreKey, setSelectedStoreKey] = useState(
    item.eligibleStores?.[0]?.storeKey ?? "",
  );
  const [targetDate, setTargetDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [idempotencyKey] = useState(
    () => `${item.id}:${initialAction}:${Date.now()}`,
  );

  const [commitCreate, inFlight] = useMutation<CreateActionMutationType>(
    PilotMutationsCreateStoreActionMutation,
  );

  const needsStoreChoice = (item.eligibleStores?.length ?? 0) > 1;

  return (
    <form
      className="mt-3 p-4 rounded-2xl space-y-3 text-xs bg-black/30"
      style={BORDER}
      onSubmit={(e) => {
        e.preventDefault();
        setErrorMsg(null);
        commitCreate({
          variables: {
            findingId: String(item.id),
            actionType,
            selectedStoreKey: selectedStoreKey || null,
            idempotencyKey,
            providerUuid: null,
            ownerUserId: null,
            targetDate: targetDate || null,
            dueDate: dueDate || null,
            budgetAmount: budgetAmount.trim() || null,
            holdReason: holdReason.trim(),
            nextReviewDate: nextReviewDate || null,
            notes: notes.trim(),
          },
          onCompleted: (r) => {
            if (r.createStoreInsightAction.ok) {
              onSaved();
            } else {
              setErrorMsg(
                r.createStoreInsightAction.error ?? "Unable to record action.",
              );
            }
          },
          onError: (err) => {
            setErrorMsg(err.message);
          },
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full p-0.5" style={BORDER}>
          {(["rebook", "hold", "restock"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActionType(t)}
              className="px-3 py-1 rounded-full font-semibold"
              style={
                actionType === t
                  ? { background: "#c5f546", color: "#0A0B0D" }
                  : META
              }
            >
              {storeActionLabel(t)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 rounded-lg"
          style={META}
        >
          Cancel
        </button>
      </div>

      {errorMsg && (
        <div
          className="p-2.5 rounded-xl"
          style={{
            background: "rgba(239,90,42,0.16)",
            color: "#ef5a2a",
          }}
        >
          {errorMsg}
        </div>
      )}

      {needsStoreChoice && (
        <label className="block space-y-1">
          <span style={META}>
            Chain-level finding — choose target store in your workspace *
          </span>
          <select
            required
            value={selectedStoreKey}
            onChange={(e) => setSelectedStoreKey(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40"
            style={BORDER}
          >
            <option value="">Select eligible store…</option>
            {(item.eligibleStores ?? []).map((st) => (
              <option key={st.storeKey} value={st.storeKey}>
                {st.storeLabel}
              </option>
            ))}
          </select>
        </label>
      )}

      {actionType === "rebook" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span style={META}>Target Return Date</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40"
              style={BORDER}
            />
          </label>
          <label className="space-y-1">
            <span style={META}>Approved Demo Budget ($)</span>
            <input
              type="number"
              step="0.01"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              placeholder="250.00"
              className="w-full px-3 py-2 rounded-xl mono bg-black/40"
              style={BORDER}
            />
          </label>
        </div>
      )}

      {actionType === "hold" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span style={META}>Hold Reason *</span>
            <input
              required
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Out of stock / low velocity"
              className="w-full px-3 py-2 rounded-xl bg-black/40"
              style={BORDER}
            />
          </label>
          <label className="space-y-1">
            <span style={META}>Next Review Date</span>
            <input
              type="date"
              value={nextReviewDate}
              onChange={(e) => setNextReviewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40"
              style={BORDER}
            />
          </label>
        </div>
      )}

      {actionType === "restock" && (
        <label className="block space-y-1">
          <span style={META}>Follow-Up / Store Check Due Date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40"
            style={BORDER}
          />
        </label>
      )}

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Instructions or buyer context…"
        className="w-full px-3 py-2 rounded-xl bg-black/40"
        style={BORDER}
      />

      <button
        type="submit"
        disabled={inFlight}
        className="px-4 py-2 rounded-xl font-bold"
        style={{ background: "#c5f546", color: "#0A0B0D" }}
      >
        {inFlight ? "Saving decision…" : `Confirm ${storeActionLabel(actionType)}`}
      </button>
    </form>
  );
};

const RecommendationRow: React.FC<{
  item: Item;
  first: boolean;
  onActionSaved?: () => void;
}> = ({ item, first, onActionSaved }) => {
  const [openAction, setOpenAction] = useState<StoreActionTypeKind | null>(
    null,
  );

  return (
    <li
      className="py-3.5 first:pt-0 last:pb-0"
      style={first ? undefined : { borderTop: "1px solid var(--spark-border)" }}
    >
      <p className="text-sm leading-relaxed" style={TEXT}>
        {item.text}
      </p>

      {/* Additive deterministic evidence strip */}
      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs" style={META}>
        {item.visitCount != null && (
          <span className="mono">{item.visitCount} visits</span>
        )}
        {item.comparisonPeriod && <span>· {item.comparisonPeriod}</span>}
        {item.supportedCost && (
          <span className="mono">· Supported cost ${item.supportedCost}</span>
        )}
        {item.adjustedPosUnits != null && (
          <span className="mono">· Adjusted POS {item.adjustedPosUnits}u</span>
        )}
        {item.isDraft && <span>· Draft (actions disabled until published)</span>}
      </div>

      {/* Published-only closed-loop actions (never rendered on drafts) */}
      {!item.isDraft && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {item.currentActionType ? (
            <Link
              to="/buyer-report"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(197,245,70,0.14)",
                color: "#c5f546",
              }}
            >
              {storeActionLabel(item.currentActionType as StoreActionTypeKind)} ·{" "}
              {item.currentActionStatus}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpenAction("rebook")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: "rgba(197,245,70,0.14)",
                  color: "#c5f546",
                }}
              >
                Rebook
              </button>
              <button
                type="button"
                onClick={() => setOpenAction("hold")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={BORDER}
              >
                Hold
              </button>
              <button
                type="button"
                onClick={() => setOpenAction("restock")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={BORDER}
              >
                Restock check
              </button>
            </>
          )}
        </div>
      )}

      {openAction && !item.isDraft && (
        <RecommendationActionDrawer
          item={item}
          initialAction={openAction}
          onClose={() => setOpenAction(null)}
          onSaved={() => {
            setOpenAction(null);
            onActionSaved?.();
          }}
        />
      )}
    </li>
  );
};

const AlertItemRow: React.FC<{ item: AlertItem; first: boolean }> = ({
  item,
  first,
}) => (
  <li
    className="py-3 first:pt-0 last:pb-0"
    style={first ? undefined : { borderTop: "1px solid var(--spark-border)" }}
  >
    <p className="text-sm leading-relaxed" style={TEXT}>
      {item.text}
    </p>
    {item.isDraft ? (
      <p className="text-xs mt-1" style={META}>
        Draft
      </p>
    ) : null}
  </li>
);

const Group: React.FC<{
  title: string;
  items: readonly Item[];
  onActionSaved?: () => void;
}> = ({ title, items, onActionSaved }) =>
  items.length ? (
    <div>
      <h3 className="text-xs font-semibold mb-2" style={META}>
        {title}
      </h3>
      <ul className="m-0 p-0 list-none">
        {items.map((item, i) => (
          <RecommendationRow
            key={item.id}
            item={item}
            first={i === 0}
            onActionSaved={onActionSaved}
          />
        ))}
      </ul>
    </div>
  ) : null;

/** "Where to go next": stores to go back to, and what to fix. */
export const WhereToGoNextCard: React.FC<{
  items: readonly Item[];
  onActionSaved?: () => void;
}> = ({ items, onActionSaved }) => {
  if (!items.length) return null;
  const { goBack, fix } = groupRecommendations(items);
  return (
    <section className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-x-4 gap-y-1">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Where to go next
        </h2>
        <div className="flex items-center gap-3 text-xs" style={META}>
          <span>Last 90 days</span>
          <Link to="/buyer-report" className="underline underline-offset-2">
            Weekly buyer table →
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-5 max-w-3xl">
        <Group title="Go back" items={goBack} onActionSaved={onActionSaved} />
        <Group title="Fix" items={fix} onActionSaved={onActionSaved} />
      </div>
      {items.some((i) => i.isDraft) ? (
        <DraftNote />
      ) : (
        <p className="text-xs mt-4" style={META}>
          Worked out from approved recaps. Visits with no product are left out of conversion.
          Reviewed by the Ignite team.
        </p>
      )}
    </section>
  );
};

/** Short factual notices about the last finished week. */
export const AlertsCard: React.FC<{ items: readonly AlertItem[] }> = ({
  items,
}) => {
  if (!items.length) return null;
  return (
    <section className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-x-4 gap-y-1">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Alerts
        </h2>
        <p className="text-xs" style={META}>
          From approved recaps
        </p>
      </div>
      <ul className="m-0 p-0 list-none max-w-3xl">
        {items.map((item, i) => (
          <AlertItemRow key={item.id} item={item} first={i === 0} />
        ))}
      </ul>
      {items.some((i) => i.isDraft) ? (
        <DraftNote />
      ) : (
        <p className="text-xs mt-4" style={META}>
          Reviewed by the Ignite team.
        </p>
      )}
    </section>
  );
};

const Body: React.FC<{ tenantId: string; forClient: boolean }> = ({
  tenantId,
  forClient,
}) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    TenantStoreInsightsQuery,
    { tenantId },
    { fetchPolicy: fetchKey > 0 ? "network-only" : "store-or-network", fetchKey },
  );
  const insights = data.tenantStoreInsights;
  if (!insights) return null;
  // Never a draft in the brand's view, whatever the server sent.
  const recommendations = visibleInsights(insights.recommendations, forClient);
  const alerts = visibleInsights(insights.alerts, forClient);
  if (!recommendations.length && !alerts.length) return null;
  return (
    <div className="flex flex-col gap-4">
      <AlertsCard items={alerts} />
      <WhereToGoNextCard
        items={recommendations}
        onActionSaved={() => setFetchKey((k) => k + 1)}
      />
    </div>
  );
};

/**
 * The brand dashboard's "Alerts" and "Where to go next" cards. The query
 * stays off the page document, so if it fails the boundary renders nothing
 * and the rest of the dashboard still loads. Nothing here asks the model.
 */
const StoreInsightsCards: React.FC<{ tenantId: string; forClient?: boolean }> = ({
  tenantId,
  forClient = false,
}) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <Body tenantId={tenantId} forClient={forClient} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default StoreInsightsCards;
