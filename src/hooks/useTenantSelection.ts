import { useCallback } from "react";
import { useAuthStore } from "@store/authStore";

export function useTenantSelection() {
  const tenantUuid = useAuthStore((state) => state.tenantUuid);
  const tenantId = useAuthStore((state) => state.tenantId);

  const setTenantUuid = useAuthStore((state) => state.setTenantUuid);
  const setTenantId = useAuthStore((state) => state.setTenantId);

  const selectTenant = useCallback(
    (uuid: string, id: string) => {
      setTenantUuid(uuid);
      setTenantId(id);
    },
    [setTenantUuid, setTenantId]
  );

  const clearTenant = useCallback(() => {
    setTenantUuid(null);
    setTenantId(null);
  }, [setTenantUuid, setTenantId]);

  return {
    tenantUuid,
    tenantId,
    selectTenant,
    clearTenant,
  };
}
