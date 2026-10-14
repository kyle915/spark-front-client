import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import {
  PUBLIC_RETAILER_MIX_QUERY,
  PUBLIC_RETAILER_QUERY,
} from "@/public/api/queries/PublicRetailer.query";
import { mapQuery } from "../utils/map";

interface Retailer {
  id: string;
  name: string;
  address?: string | null;
  location?: {
    id: string;
    name: string;
    state?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface NodeRetailer {
  publicRetailers: { edges: { node: Retailer }[] };
}

interface RetailerMix {
  national: { totalCount: number } | null;
  regional: { totalCount: number } | null;
}

export function usePublicRetailer(
  requestUrlName: string,
  stateId?: string,
  q?: string,
  isNational?: boolean,
) {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    const filters: { isNational?: boolean; stateId?: string } = {};
    if (typeof isNational === "boolean") filters.isNational = isNational;
    if (isNational === false && stateId) filters.stateId = stateId;

    gqlRequest<NodeRetailer>(PUBLIC_RETAILER_QUERY, {
      requestUrlName,
      filters: Object.keys(filters).length ? filters : null,
      q,
    })
      .then((data) => {
        setRetailers(mapQuery(data.publicRetailers?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName, stateId, q, isNational]);

  return { retailers, loading };
}

/** True when the brand's accounts are all regional stores (a preloaded store
 * roster, no national banners) — the picker should open on those, not on an
 * empty "national" list. */
export function usePublicPrefersRegionalRetailers(requestUrlName: string) {
  const [prefersRegional, setPrefersRegional] = useState(false);

  useEffect(() => {
    if (!requestUrlName) return;
    gqlRequest<RetailerMix>(PUBLIC_RETAILER_MIX_QUERY, { requestUrlName })
      .then((data) => {
        setPrefersRegional(
          (data.national?.totalCount ?? 0) === 0 && (data.regional?.totalCount ?? 0) > 0,
        );
      })
      .catch(() => setPrefersRegional(false));
  }, [requestUrlName]);

  return prefersRegional;
}
