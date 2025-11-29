// import { useLazyLoadQuery } from "react-relay";
// import { PublicDistributorsQuery } from "../../api/queries/PublicDistributors.query";
// import type { PublicDistributorsQuery as Q } from "../../api/queries/__generated__/PublicDistributorsQuery.graphql";
// import { mapQuery } from "../utils/map";

// export function usePublicDistributors(requestUrlName: string) {
//   const data = useLazyLoadQuery<Q>(
//     PublicDistributorsQuery,
//     { requestUrlName },
//     { fetchPolicy: "store-and-network" }
//   );

//   console.log("usePublicDistributors data:", data);

//   return mapQuery(data.publicDistributors?.edges);
// }

import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_DISTRIBUTORS_QUERY } from "@/public/api/queries/PublicDistributors.query";
import { mapQuery } from "../utils/map";

export function usePublicDistributors(requestUrlName: string) {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<any>(PUBLIC_DISTRIBUTORS_QUERY, { requestUrlName })
      .then((data) => {
        setDistributors(mapQuery(data.publicDistributors?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { distributors, loading };
}
