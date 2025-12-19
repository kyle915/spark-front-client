import { useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import type { TenantOption } from "@shared/TenantPicker";

type UseTenantSelectionResult = {
    tenantOptions: TenantOption[];
    selectedTenantId: string;
    setSelectedTenantId: (tenantId: string) => void;
};

export const useTenantSelection = (): UseTenantSelectionResult => {
    const tenantsData = useLazyLoadQuery<TenantsQueryType>(
        TenantsQuery,
        {},
        { fetchPolicy: "store-and-network" }
    );

    const tenantOptions = useMemo(
        () =>
            tenantsData.tenants.edges.map((edge) => ({
                value: edge.node.id,
                label: edge.node.name,
            })),
        [tenantsData]
    );

    const [selectedTenantId, setSelectedTenantId] = useState<string>(
        tenantOptions[0]?.value ?? ""
    );

    useEffect(() => {
        if (!selectedTenantId && tenantOptions.length > 0) {
            setSelectedTenantId(tenantOptions[0].value);
        }
    }, [selectedTenantId, tenantOptions]);

    return {
        tenantOptions,
        selectedTenantId,
        setSelectedTenantId,
    };
};
