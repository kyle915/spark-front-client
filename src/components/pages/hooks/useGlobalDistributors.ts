import { useEffect, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@/api/relay/environment";
import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@/api/queries/__generated__/DistributorsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

export type DistributorOption = {
  value: string;
  label: string;
};

let cachedDistributors: DistributorOption[] | null = null;

export function useGlobalDistributors() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const [distributors, setDistributors] = useState<DistributorOption[]>(
    cachedDistributors ?? [],
  );
  const [loading, setLoading] = useState(!cachedDistributors);

  useEffect(() => {
    if (cachedDistributors || !tenantId) return;

    const load = async () => {
      setLoading(true);

      const response = await fetchQuery<DistributorsQueryType>(
        environment,
        DistributorsQuery,
        {
          filters: { tenantId },
          first: 200,
        },
      ).toPromise();

      const nodes =
        response?.distributors?.edges?.map((e) => e.node).filter(Boolean) ?? [];

      const options = nodes.map((node) => ({
        value: node!.id,
        label: node!.name ?? node!.email ?? node!.id,
      }));

      cachedDistributors = options;
      setDistributors(options);
      setLoading(false);
    };

    void load();
  }, [tenantId]);

  return { distributors, loading };
}
