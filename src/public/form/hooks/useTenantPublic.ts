import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_TENANT_QUERY } from "@/public/api/queries/PublicTenantQuery";

type UseTenantPublicOptions = {
  slug: string | null | undefined;
  enabled?: boolean;
};

export type TenantPublic = {
  id: string;
  uuid: string;
  image: string | null;
  requestUrlName: string;
};

type TenantPublicResponse = {
  tenantPublic: TenantPublic | null;
};

export function useTenantPublic({
  slug,
  enabled = true,
}: UseTenantPublicOptions) {
  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =====================================================
   * Fetch Public Tenant
   * ===================================================== */
  useEffect(() => {
    if (!slug || !enabled) {
      setTenant(null);
      return;
    }

    let isMounted = true;

    async function fetchTenant() {
      setLoading(true);
      setError(null);

      try {
        const result = await gqlRequest<TenantPublicResponse>(
          PUBLIC_TENANT_QUERY,
          { requestUrlName: slug },
        );

        if (isMounted) {
          setTenant(result?.tenantPublic ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setTenant(null);
          setError((err as Error).message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchTenant();

    return () => {
      isMounted = false;
    };
  }, [slug, enabled]);

  return {
    tenant,
    hasImage: Boolean(tenant?.image),
    loading,
    error,
  };
}

export default useTenantPublic;
