import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import {
  PUBLIC_RETAILER_MIX_QUERY,
  PUBLIC_RETAILER_QUERY,
} from "@/public/api/queries/PublicRetailer.query";
import { mapQuery } from "../utils/map";
import { retailerMatchesSearch } from "@/utils/retailerOptionLabel";

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
  const mix = usePublicRetailerMix(requestUrlName);
  return !!mix && mix.national === 0 && mix.regional > 0;
}

/** National vs regional account counts for the brand; null until loaded. */
export function usePublicRetailerMix(requestUrlName: string) {
  const [mix, setMix] = useState<{ national: number; regional: number } | null>(null);

  useEffect(() => {
    if (!requestUrlName) return;
    gqlRequest<RetailerMix>(PUBLIC_RETAILER_MIX_QUERY, { requestUrlName })
      .then((data) =>
        setMix({
          national: data.national?.totalCount ?? 0,
          regional: data.regional?.totalCount ?? 0,
        }),
      )
      .catch(() => setMix(null));
  }, [requestUrlName]);

  return mix;
}

/** Debounced search over the brand's saved store accounts. The server
 * matches the longest word against name or address; the rest are narrowed
 * client-side. */
export function usePublicStoreAccountSearch(
  requestUrlName: string,
  q: string,
  enabled: boolean,
  limit = 8,
) {
  const [matches, setMatches] = useState<Retailer[]>([]);
  const [searchedQ, setSearchedQ] = useState("");

  useEffect(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!enabled || !requestUrlName || q.trim().length < 2) {
      setMatches([]);
      setSearchedQ("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      gqlRequest<NodeRetailer>(PUBLIC_RETAILER_QUERY, {
        requestUrlName,
        filters: { isNational: false },
        q: words.reduce((a, b) => (b.length > a.length ? b : a), ""),
      })
        .then((data) => {
          if (cancelled) return;
          const hits = mapQuery(data.publicRetailers?.edges).filter((r) =>
            retailerMatchesSearch(r, q),
          );
          setMatches(hits.slice(0, limit));
          setSearchedQ(q);
        })
        .catch(() => {
          if (cancelled) return;
          setMatches([]);
          setSearchedQ(q);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestUrlName, q, enabled, limit]);

  return { matches, searching: enabled && q.trim().length >= 2 && searchedQ !== q };
}
