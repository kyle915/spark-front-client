import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_BILLING_ENTITIES_QUERY } from "@/public/api/queries/PublicBillingEntities.query";
import { mapQuery } from "../utils/map";

interface BillingEntity {
  id: string;
  name: string;
}

interface NodeBillingEntities {
  publicBillingEntities: { edges: { node: BillingEntity }[] };
}

export function usePublicBillingEntities(requestUrlName: string, q?: string) {
  const [billingEntities, setBillingEntities] = useState<BillingEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<NodeBillingEntities>(PUBLIC_BILLING_ENTITIES_QUERY, {
      requestUrlName,
      q,
    })
      .then((data) => {
        setBillingEntities(mapQuery(data.publicBillingEntities?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName, q]);

  return { billingEntities, loading };
}
