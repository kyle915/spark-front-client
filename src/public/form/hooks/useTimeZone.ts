import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { QUERY_PUBLIC_TIME_ZONES } from "@/public/api/queries/PublicTimeZones.query";
import { mapQuery } from "../utils/map";

interface TimeZone {
  id: string;
  name: string;
}

interface NodeTimeZone {
  publicTimezones: { edges: { node: TimeZone }[] };
}

export function usePublicTimeZones() {
  const [timeZones, setTimeZones] = useState<TimeZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    gqlRequest<NodeTimeZone>(QUERY_PUBLIC_TIME_ZONES)
      .then((data) => {
        setTimeZones(mapQuery(data.publicTimezones?.edges));
      })
      .finally(() => setLoading(false));
  }, []);

  console.log("usePublicTimeZones", { timeZones, loading });

  return { timeZones, loading };
}
