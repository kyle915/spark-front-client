import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantSampleNextQuery } from "@/api/queries/TenantSampleNextQuery";
import type { TenantSampleNextQuery as TenantSampleNextQueryType } from "@api/queries/__generated__/TenantSampleNextQuery.graphql";
import { sampleNextKindLabel } from "@/lib/dashboardExplain";

const META = { color: "var(--spark-text-meta)" } as const;

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantSampleNextQueryType>(
    TenantSampleNextQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  // Null: the server does not show this list to this person.
  const result = data.tenantSampleNext;
  if (!result) return null;
  const items = result.items;
  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Where to sample next">
      <h2 className="text-base font-semibold">Where to sample next</h2>
      <p className="text-xs mt-1" style={META}>
        Stores never visited, and stores that converted well and have not had a visit for a
        while. Ranked from approved recaps.
      </p>
      {items.length === 0 ? (
        <p className="text-sm mt-4" style={META}>
          Nothing to suggest yet. Upload an account list, or wait for more approved recaps.
        </p>
      ) : (
        <ol className="m-0 mt-4 p-0 list-none">
          {items.map((item, i) => (
            <li
              key={item.key}
              className="py-3 flex gap-3"
              style={i > 0 ? { borderTop: "1px solid var(--spark-border)" } : undefined}
            >
              <span className="text-sm tab-num w-5 shrink-0" style={META}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium break-words" style={{ color: "var(--spark-text)" }}>
                  {item.name}
                  {item.market ? (
                    <span className="font-normal" style={META}>
                      {" "}
                      · {item.market}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "var(--spark-text-secondary)" }}>
                  {item.reason}
                </p>
                <p className="text-xs mt-0.5 break-words" style={META}>
                  {sampleNextKindLabel(item.kind)}
                  {item.address ? ` · ${item.address}` : ""}
                </p>
              </div>
            </li>
          ))}
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
const SampleNextList: React.FC<{ tenantId: string | null | undefined }> = ({ tenantId }) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <Inner tenantId={tenantId} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default SampleNextList;
