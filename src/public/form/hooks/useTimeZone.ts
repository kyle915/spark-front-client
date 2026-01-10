import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { QUERY_PUBLIC_TIME_ZONES } from "@/public/api/queries/PublicTimeZones.query";
import { mapQuery } from "../utils/map";

interface TimeZone {
  id: string;
  name: string;
  code?: string;
  offset?: string | number | null;
}

interface NodeTimeZone {
  publicTimezones: { edges: { node: TimeZone }[] };
}

function formatOffsetMinutes(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  return `UTC${sign}${paddedHours}:${paddedMinutes}`;
}

function formatOffset(offset?: string | number | null) {
  if (offset === null || offset === undefined) return "";

  if (typeof offset === "number") {
    return formatOffsetMinutes(offset);
  }

  const cleanedOffset = `${offset}`.trim();
  if (!cleanedOffset) return "";

  const isNumeric = /^-?\\d+$/.test(cleanedOffset);
  if (isNumeric) {
    return formatOffsetMinutes(parseInt(cleanedOffset, 10));
  }

  const hasUtcPrefix = cleanedOffset.toUpperCase().startsWith("UTC");
  return hasUtcPrefix ? cleanedOffset : `UTC${cleanedOffset}`;
}

function formatTimeZoneLabel(tz: TimeZone) {
  const code = tz.code ? `-${tz.code}` : "";
  const offset = tz.offset ? ` (${formatOffset(tz.offset)})` : "";
  return `${tz.name}${code}${offset}`;
}

export function usePublicTimeZones() {
  const [timeZones, setTimeZones] = useState<TimeZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    gqlRequest<NodeTimeZone>(QUERY_PUBLIC_TIME_ZONES)
      .then((data) => {
        const formattedTimeZones = mapQuery(data.publicTimezones?.edges).map(
          (tz) => ({
            ...tz,
            name: formatTimeZoneLabel(tz),
          })
        );
        setTimeZones(formattedTimeZones);
      })
      .finally(() => setLoading(false));
  }, []);

  console.log("usePublicTimeZones", { timeZones, loading });

  return { timeZones, loading };
}
