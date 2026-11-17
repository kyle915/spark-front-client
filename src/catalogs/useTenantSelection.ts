import { useEffect, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import type { TenantOption } from "@shared/TenantPicker";

type UseTenantSelectionResult = {
    tenantOptions: TenantOption[];
    selectedTenantId: string;
    setSelectedTenantId: (tenantId: string) => void;
};

type Preferred = {
    /** The client picked in the sidebar (global id), if any. */
    tenantId?: string | null;
    tenantUuid?: string | null;
};

/**
 * Which option a page should open on: the client already picked in the
 * sidebar when it is one of `options`, else the first (alphabetical) option.
 */
export function initialTenantOption(
    options: ReadonlyArray<TenantOption & { uuid?: string | null }>,
    preferred: Preferred = {},
): string {
    const match = options.find(
        (o) =>
            (preferred.tenantId && o.value === preferred.tenantId) ||
            (preferred.tenantUuid && o.uuid === preferred.tenantUuid),
    );
    return (match ?? options[0])?.value ?? "";
}

export const useTenantSelection = (
    preferred: Preferred = {},
): UseTenantSelectionResult => {
    const tenantsData = useLazyLoadQuery<TenantsQueryType>(
        TenantsQuery,
        // The tenants connection defaults to 10 rows; 500 is its cap.
        { first: 500 },
        { fetchPolicy: "store-and-network" }
    );

    const tenantOptions = useMemo(
        () =>
            tenantsData.tenants.edges
                .map((edge) => ({
                    value: edge.node.id,
                    label: edge.node.name,
                    uuid: edge.node.uuid,
                }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        [tenantsData]
    );

    const [selectedTenantId, setSelectedTenantId] = useState<string>(() =>
        initialTenantOption(tenantOptions, preferred)
    );

    // Follow the sidebar: switching client there switches this page too. Only
    // on a real change, so a pick made in this page's own dropdown sticks.
    const preferredKey = `${preferred.tenantId ?? ""}|${preferred.tenantUuid ?? ""}`;
    const appliedKey = useRef(preferredKey);
    useEffect(() => {
        if (appliedKey.current === preferredKey) return;
        appliedKey.current = preferredKey;
        const next = initialTenantOption(tenantOptions, preferred);
        if (next) setSelectedTenantId(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferredKey, tenantOptions]);

    useEffect(() => {
        if (!selectedTenantId && tenantOptions.length > 0) {
            setSelectedTenantId(initialTenantOption(tenantOptions, preferred));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTenantId, tenantOptions]);

    return {
        tenantOptions,
        selectedTenantId,
        setSelectedTenantId,
    };
};
