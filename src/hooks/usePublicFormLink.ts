import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantCheckinCodeQuery } from "@/api/queries/TenantCheckinCodeQuery";
import type { TenantCheckinCodeQuery as TenantCheckinCodeQueryType } from "@api/queries/__generated__/TenantCheckinCodeQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import {
  resolvePublicFormLink,
  type PublicFormLink,
} from "@/utils/publicHosts";

/**
 * Public form (or standing check-in) for the active tenant.
 *
 * PR 526 only read `tenantMeta.requestUrlName` from localStorage. Feel
 * Free never got a spark-form slug — BAs use the standing check-in —
 * so the pill hid. This query is the same tiny tenant list Walk-ups
 * already loads; we pick the active tenant and prefer requestUrlName,
 * then checkinCode.
 */
export function usePublicFormLink(): PublicFormLink | null {
  const { user, tenantId, tenantUuid, tenantMeta } = useAuthStore();
  const data = useLazyLoadQuery<TenantCheckinCodeQueryType>(
    TenantCheckinCodeQuery,
    { userUuid: user?.uuid ?? null },
    { fetchPolicy: "store-or-network" },
  );

  const nodes = (data?.tenants?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  const node =
    nodes.find(
      (n) =>
        String(n.id) === String(tenantId) ||
        String(n.uuid) === String(tenantId) ||
        String(n.uuid) === String(tenantUuid),
    ) ?? null;

  return resolvePublicFormLink({
    requestUrlName: node?.requestUrlName ?? tenantMeta?.requestUrlName,
    checkinCode: node?.checkinCode ?? tenantMeta?.checkinCode,
  });
}

export default usePublicFormLink;
