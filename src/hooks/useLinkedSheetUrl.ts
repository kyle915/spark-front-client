import { useCallback, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { LinkedSheetQuery } from "@/api/queries/LinkedSheetQuery";
import type { LinkedSheetQuery as LinkedSheetQueryType } from "@api/queries/__generated__/LinkedSheetQuery.graphql";
import { SetLinkedSheetMutation } from "@/api/mutations/SetLinkedSheetMutation";
import type { SetLinkedSheetMutation as SetLinkedSheetMutationType } from "@api/mutations/__generated__/SetLinkedSheetMutation.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Single source of truth for the per-tenant linked Google Sheet URL.
 *
 * Backend-backed via tenant.linkedSheetUrl. While we're still rolling
 * out we keep localStorage as a backwards-compatible fallback:
 *
 *   - On first read with no backend value but a localStorage value
 *     present, we transparently push the localStorage value up to the
 *     backend (one-time migration per tenant).
 *   - Reads always prefer backend.
 *   - Writes go to backend; we mirror to localStorage as a network-
 *     offline fallback (so the chip keeps working if the page loads
 *     before the query resolves).
 *
 * Returns { url, setUrl, saving } so callers can render a chip + a
 * controlled input.
 */
const LS_KEY = (tenantId: string) => `@spark.linkedSheet.url/${tenantId}`;

export function useLinkedSheetUrl(): {
  url: string;
  setUrl: (next: string) => Promise<{ ok: boolean; message?: string }>;
  saving: boolean;
} {
  const { tenantId, user } = useAuthStore();
  const userUuid = user?.uuid ?? null;
  const [fetchKey, setFetchKey] = useState(0);

  const data = useLazyLoadQuery<LinkedSheetQueryType>(
    LinkedSheetQuery,
    { userUuid: userUuid ?? null },
    {
      fetchPolicy: "store-or-network",
      fetchKey,
    },
  );
  // Find the active tenant among the user's tenants. tenantId is the
  // Relay base64 id (matches node.id); we also accept the uuid match
  // because the auth store sometimes stores uuid form.
  const nodes = (data?.tenants?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  const node =
    nodes.find(
      (n) =>
        String(n.id) === String(tenantId) ||
        String(n.uuid) === String(tenantId),
    ) ?? nodes[0] ?? null;
  const backendUrl = (node?.linkedSheetUrl ?? "") as string;

  // Local mirror — primes from localStorage so the chip can render
  // immediately before the GraphQL response arrives, then syncs with
  // whatever the backend has on resolve.
  const [localUrl, setLocalUrl] = useState<string>(() => {
    if (!tenantId) return "";
    try {
      return localStorage.getItem(LS_KEY(tenantId)) ?? "";
    } catch {
      return "";
    }
  });

  const [commit, saving] = useMutation<SetLinkedSheetMutationType>(
    SetLinkedSheetMutation,
  );

  // One-time migration: backend empty, localStorage has a value →
  // push it up. Runs once per tenant. After this we never read from
  // localStorage as the source of truth.
  useEffect(() => {
    if (!tenantId || !node) return;
    if (backendUrl) return;
    if (!localUrl) return;
    commit({
      variables: { input: { tenantId, sheetUrl: localUrl } },
      onCompleted: () => {
        setFetchKey((k) => k + 1);
      },
    });
    // Intentionally NOT re-running on backendUrl change — once we've
    // migrated, the next render reads backendUrl correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, node]);

  // Pick the freshest value. Backend wins after resolution; local
  // pre-fetch only matters during the initial paint.
  const url = backendUrl || localUrl || "";

  const setUrl = useCallback(
    async (next: string): Promise<{ ok: boolean; message?: string }> => {
      const trimmed = next.trim();
      if (!tenantId) {
        return { ok: false, message: "No tenant in scope." };
      }
      return new Promise((resolve) => {
        commit({
          variables: { input: { tenantId, sheetUrl: trimmed || null } },
          onCompleted: (resp) => {
            const r = resp.setLinkedSheet;
            if (r?.success) {
              setLocalUrl(trimmed);
              try {
                if (trimmed) {
                  localStorage.setItem(LS_KEY(tenantId), trimmed);
                } else {
                  localStorage.removeItem(LS_KEY(tenantId));
                }
              } catch {
                // Quota / Safari private mode — backend is the source
                // of truth anyway.
              }
              setFetchKey((k) => k + 1);
              resolve({ ok: true });
            } else {
              resolve({
                ok: false,
                message: r?.message || "Couldn't save sheet link.",
              });
            }
          },
          onError: (e) => {
            resolve({ ok: false, message: e.message });
          },
        });
      });
    },
    [tenantId, commit],
  );

  return { url, setUrl, saving };
}

export default useLinkedSheetUrl;
