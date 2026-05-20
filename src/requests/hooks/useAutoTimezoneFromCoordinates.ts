import { useEffect, useRef } from "react";
import type {
  FieldValues,
  Path,
  PathValue,
  UseFormSetValue,
} from "react-hook-form";
import { resolveTimezoneIdByDate } from "@/utils";

interface TimezoneItem {
  id: string;
  name: string;
  code: string;
  offset: number;
}

interface Params<
  TFormValues extends FieldValues,
  TFieldName extends Path<TFormValues>
> {
  coordinates?: number[] | null;
  timezoneId?: string | null;
  timezones: TimezoneItem[];
  setValue: UseFormSetValue<TFormValues>;
  timezoneFieldName: TFieldName;
  initialFromBackend?: boolean;
  date?: string | null;
}

export function useAutoTimezoneFromCoordinates<
  TFormValues extends FieldValues,
  TFieldName extends Path<TFormValues>
>({
  coordinates,
  timezoneId,
  timezones,
  setValue,
  timezoneFieldName,
  initialFromBackend,
  date,
}: Params<TFormValues, TFieldName>) {
  const lastCoordinatesLookupRef = useRef<string | null>(null);
  const lastAutoTimezoneIdRef = useRef<string | null>(null);
  const manualTimezoneOverrideRef = useRef(false);
  const isApplyingTimezoneRef = useRef(false);

  /* ---------------- detect manual override ---------------- */
  useEffect(() => {
    if (initialFromBackend) {
      manualTimezoneOverrideRef.current = false;
      return;
    }

    if (timezoneId && timezoneId !== lastAutoTimezoneIdRef.current) {
      manualTimezoneOverrideRef.current = true;
    }
  }, [timezoneId, initialFromBackend]);

  /* ---------------- handle date changes for DST ---------------- */
  useEffect(() => {
    if (!date || !timezoneId || !timezones.length || manualTimezoneOverrideRef.current) return;

    const adjustedId = resolveTimezoneIdByDate(timezones, date, timezoneId);
    if (adjustedId && adjustedId !== timezoneId) {
      lastAutoTimezoneIdRef.current = adjustedId;
      setValue(
        timezoneFieldName,
        adjustedId as PathValue<TFormValues, TFieldName>,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
    }
  }, [date, timezones, timezoneId, setValue, timezoneFieldName]);

  /* ---------------- auto-detect timezone from coordinates ---------------- */
  useEffect(() => {
    if (!coordinates || coordinates.length < 2) return;
    if (!timezones.length) return;

    const lat = Number(coordinates[0]);
    const lng = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const coordsKey = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    if (coordsKey === lastCoordinatesLookupRef.current) return;
    lastCoordinatesLookupRef.current = coordsKey;

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto`,
          { signal: controller.signal }
        );

        if (!res.ok) return;
        const data = await res.json();

        const timezoneName =
          typeof data?.timezone === "string" ? data.timezone : null;
        const timezoneAbbr =
          typeof data?.timezone_abbreviation === "string"
            ? data.timezone_abbreviation
            : null;
        const utcOffsetSeconds =
          typeof data?.utc_offset_seconds === "number"
            ? data.utc_offset_seconds
            : null;

        if (!timezoneName && !timezoneAbbr && utcOffsetSeconds === null) return;

        const offsetMinutes =
          utcOffsetSeconds !== null ? Math.round(utcOffsetSeconds / 60) : null;

        const normalize = (v?: string | null) =>
          v?.toLowerCase().replace(/\s+/g, "").replace(/_/g, "") ?? null;

        const resolveRegionName = (iana?: string | null): string | null => {
          if (!iana) return null;
          const v = iana.toLowerCase();
          if (v.startsWith("america/new_york")) return "eastern";
          if (v.startsWith("america/chicago")) return "central";
          if (v.startsWith("america/denver")) return "mountain";
          if (v.startsWith("america/los_angeles")) return "pacific";
          if (v.startsWith("america/anchorage")) return "alaska";
          if (v.startsWith("pacific/honolulu")) return "hawaii–aleutian";
          return null;
        };

        const normalizedName = normalize(timezoneName);
        const normalizedAbbr = normalize(timezoneAbbr);
        const regionName = resolveRegionName(timezoneName);

        const resolvedTimezone =
          // 1️⃣ IANA → región + offset (PRIORIDAD MÁXIMA)
          (regionName && offsetMinutes !== null
            ? timezones.find(
                (tz) =>
                  normalize(tz.name)?.startsWith(normalize(regionName) || "") &&
                  tz.offset === offsetMinutes
              )
            : null) ??
          // 2️⃣ Abbreviation + offset
          (normalizedAbbr && offsetMinutes !== null
            ? timezones.find(
                (tz) =>
                  normalize(tz.code) === normalizedAbbr &&
                  tz.offset === offsetMinutes
              )
            : null) ??
          // 3️⃣ Abbreviation only
          (normalizedAbbr
            ? timezones.find((tz) => normalize(tz.code) === normalizedAbbr)
            : null) ??
          // 4️⃣ IANA full name match
          (normalizedName
            ? timezones.find((tz) => normalize(tz.name) === normalizedName)
            : null);

        if (!resolvedTimezone) return;
        if (manualTimezoneOverrideRef.current) return;

        let finalTimezoneId = resolvedTimezone.id;
        if (date) {
          const adjustedId = resolveTimezoneIdByDate(timezones, date, finalTimezoneId);
          if (adjustedId) finalTimezoneId = adjustedId;
        }

        if (timezoneId === finalTimezoneId) {
          lastAutoTimezoneIdRef.current = finalTimezoneId;
          return;
        }

        isApplyingTimezoneRef.current = true;
        lastAutoTimezoneIdRef.current = finalTimezoneId;

        setValue(
          timezoneFieldName,
          finalTimezoneId as PathValue<TFormValues, TFieldName>,
          {
            shouldDirty: true,
            shouldValidate: true,
          }
        );
      } catch {
        if (controller.signal.aborted) return;
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [coordinates, timezoneId, timezones, setValue, timezoneFieldName, date]);
}

