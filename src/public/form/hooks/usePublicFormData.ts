import { useLazyLoadQuery } from "react-relay";
import { PublicFormDataQuery } from "../../api/queries/PublicFormData.query";
import type { PublicFormDataQuery as Q } from "../../api/queries/__generated__/PublicFormDataQuery.graphql";

export function usePublicFormData(requestUrlName: string) {
  const data = useLazyLoadQuery<Q>(
    PublicFormDataQuery,
    { requestUrlName },
    { fetchPolicy: "store-and-network" }
  );

  console.log("usePublicFormData fetched data:", data);

  const map = <T>(
    edges: ReadonlyArray<{ readonly node: T }> | null | undefined
  ): T[] => edges?.map((e) => e.node) ?? [];

  return {
    clients: map(data.publicClients?.edges),
    requestTypes: map(data.publicRequestType?.edges),
    products: map(data.publicProducts?.edges),
    // productTypes: map(data.publicProductTypes?.edges),
    distributors: map(data.publicDistributors?.edges),
    retailers: map(data.publicRetailer?.edges),
    raw: data,
  };
}
