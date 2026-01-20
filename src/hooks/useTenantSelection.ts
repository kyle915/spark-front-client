import { useCallback } from "react";
import { useAuthStore } from "@store/authStore";

type SelectTenantPayload = {
  tenantUuid: string;
  tenantId: string;
  logo?: string | null;
  requestUrlName?: string | null;
};

export function useTenantSelection() {
  const tenantUuid = useAuthStore((state) => state.tenantUuid);
  const tenantId = useAuthStore((state) => state.tenantId);
  const tenantMeta = useAuthStore((state) => state.tenantMeta);

  const setTenant = useAuthStore((state) => state.setTenant);
  const clearTenantStore = useAuthStore((state) => state.clearTenant);

  const selectTenant = useCallback(
    ({ tenantUuid, tenantId, logo, requestUrlName }: SelectTenantPayload) => {
      setTenant(tenantUuid, tenantId, logo, requestUrlName);
    },
    [setTenant]
  );

  return {
    tenantUuid,
    tenantId,
    tenantMeta,
    selectTenant,
    clearTenant: clearTenantStore,
  };
}
