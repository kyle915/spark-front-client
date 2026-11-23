import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantSampleNextQuery } from "@/api/queries/TenantSampleNextQuery";
import type { TenantSampleNextQuery as TenantSampleNextQueryType } from "@api/queries/__generated__/TenantSampleNextQuery.graphql";
import { sampleNextLine } from "@/lib/dashboardExplain";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import type { WaveTargetStore } from "@/components/pages/map/waveSchedule";

const META = { color: "var(--spark-text-meta)" } as const;

interface SampleNextListProps {
  tenantId: string | null | undefined;
  selectedKeys?: ReadonlySet<string>;
  onToggleStore?: (store: WaveTargetStore) => void;
  onSelectStores?: (stores: ReadonlyArray<WaveTargetStore>) => void;
  refreshKey?: number;
}

const Inner: React.FC<{
  tenantId: string;
  selectedKeys?: ReadonlySet<string>;
  onToggleStore?: (store: WaveTargetStore) => void;
  onSelectStores?: (stores: ReadonlyArray<WaveTargetStore>) => void;
  refreshKey?: number;
}> = ({ tenantId, selectedKeys, onToggleStore, onSelectStores, refreshKey = 0 }) => {
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
  const data = useLazyLoadQuery<TenantSampleNextQueryType>(
    TenantSampleNextQuery,
    { tenantId },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: refreshKey,
    },
  );
  // Null: the server does not show this list to this person.
  const result = data.tenantSampleNext;
  if (!result) return null;
  const items = result.items;

  const toWaveTarget = (item: (typeof items)[number]): WaveTargetStore => ({
    key: item.key,
    name: item.name,
    address: item.address ?? "",
    market: item.market ?? "",
    position:
      typeof item.lat === "number" && typeof item.lng === "number"
        ? { lat: item.lat, lng: item.lng }
        : null,
  });

  const allSelected =
    Boolean(selectedKeys) &&
    items.length > 0 &&
    items.every((item) => selectedKeys?.has(item.key));

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Where to sample next">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Where to sample next</h2>
          <p className="text-xs mt-1" style={META}>
            Stores never visited, and stores that converted well and have not had a visit for a
            while. Ranked from approved recaps.
          </p>
        </div>
        {onSelectStores && items.length > 0 ? (
          <button
            type="button"
            onClick={() => onSelectStores(items.map(toWaveTarget))}
            className="spark-btn-ghost text-xs shrink-0"
          >
            {allSelected
              ? "Suggested selected"
              : `Select all ${items.length} suggested`}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm mt-4" style={META}>
          Nothing to suggest yet. Upload an account list, or wait for more approved recaps.
        </p>
      ) : (
        <ol className="m-0 mt-4 p-0 list-none">
          {items.map((item, i) => {
            const checked = Boolean(selectedKeys?.has(item.key));
            return (
              <li
                key={item.key}
                className="py-3 flex gap-3 items-start"
                style={i > 0 ? { borderTop: "1px solid var(--spark-border)" } : undefined}
              >
                {onToggleStore ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleStore(toWaveTarget(item))}
                    aria-label={`Select ${item.name} for wave`}
                    className="mt-1 cursor-pointer shrink-0"
                  />
                ) : null}
                <p className="min-w-0 flex-1 text-sm" style={{ color: "var(--spark-text)" }}>
                  <button
                    type="button"
                    onClick={() =>
                      openStoreSheet({
                        storeKey: item.key,
                        storeName: item.name,
                        address: item.address,
                        fallbackTitle: item.name,
                      })
                    }
                    className="font-medium text-left hover:underline underline-offset-2 cursor-pointer"
                    style={{ color: "var(--spark-text)", background: "none", border: 0, padding: 0 }}
                    title={item.reason}
                  >
                    {sampleNextLine(item)}
                  </button>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

/**
 * A ranked list of stores to sample next for the selected client, each
 * with its reason in one line. The server decides who sees it (Ignite
 * staff today), so this renders nothing for everyone else.
 */
const SampleNextList: React.FC<SampleNextListProps> = ({
  tenantId,
  selectedKeys,
  onToggleStore,
  onSelectStores,
  refreshKey,
}) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <Inner
          tenantId={tenantId}
          selectedKeys={selectedKeys}
          onToggleStore={onToggleStore}
          onSelectStores={onSelectStores}
          refreshKey={refreshKey}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default SampleNextList;
