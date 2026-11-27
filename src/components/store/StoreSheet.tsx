import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Sparkles } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import SparkSheet from "@/shared/SparkSheet";
import { dispatchOpenAskSpark } from "@/lib/askSparkEvent";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore, type StoreSheetTarget } from "@/store/storeSheetStore";
import { ResolveStoreKeyQuery } from "@/api/queries/ResolveStoreKeyQuery";
import type { ResolveStoreKeyQuery as ResolveStoreKeyQueryType } from "@api/queries/__generated__/ResolveStoreKeyQuery.graphql";
import { StoreProfileContent } from "@/components/pages/store/SparkStoreProfile";
import { buildStoreScheduleHref, isStoreKey, storeHref } from "@/lib/storeProfile";

const UnresolvedStoreCard: React.FC<{
  target: StoreSheetTarget;
  tenantId?: string;
  onClose: () => void;
}> = ({ target, tenantId, onClose }) => {
  const navigate = useNavigate();
  const name = (target.storeName || target.fallbackTitle || "Store").trim();
  const address = (target.address || "").trim();
  const scheduleHref = buildStoreScheduleHref({
    name,
    address,
    state: target.state,
  });
  const mapHref = `/account-map?q=${encodeURIComponent(name)}`;

  return (
    <div className="spark-card p-5 space-y-3">
      {address ? (
        <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
          {address}
        </p>
      ) : null}
      <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
        This venue does not have a grouped store profile yet (for example, an unmapped
        walk-up or multiple locations under the same banner). You can schedule a visit or
        find its locations on the Account Map.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(scheduleHref);
          }}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            border: "none",
          }}
        >
          Schedule visit
        </button>
        <Link
          to={mapHref}
          onClick={onClose}
          className="spark-btn-ghost text-xs px-3 py-2 rounded-lg no-underline"
        >
          View on Account Map
        </Link>
        <button
          type="button"
          onClick={() => {
            onClose();
            dispatchOpenAskSpark({
              question: `Summarize recent conversion, units sold, and shopper feedback at ${name}.`,
              tenantId,
            });
          }}
          className="spark-btn-ghost text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={13} strokeWidth={1.85} />
          Ask Spark
        </button>
      </div>
    </div>
  );
};

const ResolvedStoreLoader: React.FC<{
  tenantId: string;
  target: StoreSheetTarget;
  onClose: () => void;
  onResolvedStoreKey: (key: string | null) => void;
  onResolvedTitle: (title: string) => void;
}> = ({ tenantId, target, onClose, onResolvedStoreKey, onResolvedTitle }) => {
  const directKey = isStoreKey(target.storeKey) ? target.storeKey.trim() : null;
  const data = useLazyLoadQuery<ResolveStoreKeyQueryType>(
    ResolveStoreKeyQuery,
    {
      tenantId,
      storeKey: directKey,
      requestId: directKey ? null : target.requestId ?? null,
      recapId: directKey ? null : target.recapId ?? null,
      storeName: directKey ? null : target.storeName ?? null,
      address: directKey ? null : target.address ?? null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const resolvedKey = directKey ?? (isStoreKey(data.resolveStoreKey) ? data.resolveStoreKey : null);

  useEffect(() => {
    onResolvedStoreKey(resolvedKey);
  }, [resolvedKey, onResolvedStoreKey]);

  if (!resolvedKey) {
    return (
      <UnresolvedStoreCard target={target} tenantId={tenantId} onClose={onClose} />
    );
  }

  return (
    <StoreProfileContent
      tenantId={tenantId}
      storeKey={resolvedKey}
      inDrawer
      onNavigateAway={onClose}
      onResolvedTitle={onResolvedTitle}
    />
  );
};

/**
 * Universal slide-over Store Profile drawer (`SparkSheet` right-side sheet).
 * Opens over MasterTracker, SparkRecapsList, SparkApprovals, SparkInsights,
 * and Account Map without losing scroll position or active filters.
 */
export const StoreSheet: React.FC = () => {
  const { tenantId } = useAuthStore();
  const target = useStoreSheetStore((s) => s.target);
  const closeStoreSheet = useStoreSheetStore((s) => s.closeStoreSheet);

  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [resolvedTitle, setResolvedTitle] = useState<string>("");

  // Close drawer if the active tenant switches while open.
  const [openedTenantId, setOpenedTenantId] = useState<string | null>(null);
  useEffect(() => {
    if (!target) {
      setResolvedKey(null);
      setResolvedTitle("");
      setOpenedTenantId(tenantId ? String(tenantId) : null);
      return;
    }
    const current = tenantId ? String(tenantId) : null;
    if (openedTenantId && current && openedTenantId !== current) {
      closeStoreSheet();
      return;
    }
    setOpenedTenantId(current);
    setResolvedKey(isStoreKey(target.storeKey) ? target.storeKey.trim() : null);
    setResolvedTitle("");
  }, [target, tenantId, openedTenantId, closeStoreSheet]);

  const open = Boolean(target);
  const tenant = tenantId ? String(tenantId) : "";
  const fullPageHref = storeHref(resolvedKey ?? target?.storeKey ?? null);
  const displayTitle =
    resolvedTitle || target?.fallbackTitle || target?.storeName || "Store profile";

  const targetIdentity = target
    ? [
        tenant,
        target.storeKey ?? "",
        target.requestId ?? "",
        target.recapId ?? "",
        target.storeName ?? "",
        target.address ?? "",
      ].join("|")
    : "closed";

  return (
    <SparkSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeStoreSheet();
      }}
      side="right"
      eyebrow="Store profile"
      title={displayTitle}
      headerActions={
        fullPageHref ? (
          <Link
            to={fullPageHref}
            onClick={closeStoreSheet}
            className="spark-btn-ghost text-xs px-3 py-1.5 rounded-lg no-underline whitespace-nowrap"
          >
            Open full page ↗
          </Link>
        ) : null
      }
    >
      {!target ? null : !tenant ? (
        <p className="text-sm py-4" style={{ color: "var(--spark-text-meta)" }}>
          Choose a client to view store details.
        </p>
      ) : (
        <ErrorBoundary
          key={targetIdentity}
          fallback={
            <UnresolvedStoreCard
              target={target}
              tenantId={tenant}
              onClose={closeStoreSheet}
            />
          }
        >
          <Suspense
            fallback={
              <p
                className="text-sm py-6"
                style={{ color: "var(--spark-text-meta)" }}
                role="status"
              >
                Loading store profile…
              </p>
            }
          >
            <ResolvedStoreLoader
              tenantId={tenant}
              target={target}
              onClose={closeStoreSheet}
              onResolvedStoreKey={setResolvedKey}
              onResolvedTitle={setResolvedTitle}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </SparkSheet>
  );
};

export default StoreSheet;
