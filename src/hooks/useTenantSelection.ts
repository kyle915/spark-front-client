import { useCallback } from "react";
import { useAuthStore } from "@store/authStore";

export function useTenantSelection() {
    const tenantUuid = useAuthStore((state) => state.tenantUuid);
    const setTenantUuid = useAuthStore((state) => state.setTenantUuid);

    const selectTenant = useCallback(
        (uuid: string) => {
            setTenantUuid(uuid);
        },
        [setTenantUuid]
    );

    const clearTenant = useCallback(() => {
        setTenantUuid(null);
    }, [setTenantUuid]);

    return {
        tenantUuid,
        selectTenant,
        clearTenant,
    };
}
