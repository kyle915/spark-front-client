import { dateFormat } from "./toDate";
import { buildDateTimeWithOffset, resolveTimezoneIdByDate } from "@/utils";
import type { SparkFormData } from "../schema/schema";
import type { CreateRequestInput } from "../types/CreateRequestByUrl";

const CLIENT_PLACEHOLDER = {
  name: "N/A",
  email: "no-client@placeholder.local",
};

// Timezone option as the public forms hold it. `name`/`code` are
// optional here only so callers with a thinner shape still type-check;
// they're what `resolveTimezoneIdByDate` uses to pick the STD vs DST
// variant, so pass them whenever available (the public dropdown does).
type TimeZoneOption = {
  id: string;
  name?: string | null;
  code?: string | null;
  offset: number;
};

/**
 * Resolve the DST-aware UTC offset for the selected timezone ON THE
 * EVENT DATE and bake it into the date/start/end ISO strings.
 *
 * Single source of truth for how both public request forms (the wizard
 * via `buildPayload`, and the Express form) turn a (date, time, picked
 * tz) into the offset-bearing timestamps the backend expects — e.g.
 * `2026-06-15T11:00-04:00` rather than a naive `...T11:00:00` with no
 * offset.
 *
 * CRITICAL (the #166 trap): we do NOT trust the picked option's static
 * `offset` blindly. A user may pick "Pacific" while it's PDT today but
 * schedule a January (PST) visit, or vice-versa; `matchTimezoneOption`
 * also picks the variant by *today's* DST, not the event date's. So we
 * first re-resolve the picked tz id to the correct STD/DST sibling FOR
 * THE DATE (`resolveTimezoneIdByDate`), then use that sibling's offset.
 * Falls back to the picked option (then no offset) if resolution can't
 * find a match, which preserves prior behavior rather than guessing.
 */
export function buildRequestDateTimes(
  timeZones: TimeZoneOption[],
  timezoneId: string | null | undefined,
  dateValue: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { date: string; startTime: string; endTime: string } {
  const dstAwareId = timezoneId
    ? resolveTimezoneIdByDate(timeZones, dateValue, timezoneId)
    : null;
  const resolvedId = dstAwareId ?? timezoneId ?? null;
  const timezone = resolvedId
    ? (timeZones.find((tz) => tz.id === resolvedId) ?? null)
    : null;
  const offsetMinutes = timezone?.offset ?? null;

  return {
    date: dateValue
      ? buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes)
      : "",
    startTime:
      dateValue && startTime
        ? buildDateTimeWithOffset(dateValue, startTime, offsetMinutes)
        : "",
    endTime:
      dateValue && endTime
        ? buildDateTimeWithOffset(dateValue, endTime, offsetMinutes)
        : "",
  };
}

export function buildPayload(
  values: SparkFormData,
  timeZones: TimeZoneOption[] = [],
): CreateRequestInput {
  const isTableNeeded =
    String(values.details?.[0]?.isTableNeeded).toLowerCase() === "true";
  const dateValue = dateFormat(values.date ?? "");
  const dateForName = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? `${dateValue.slice(5, 7)}/${dateValue.slice(8, 10)}/${dateValue.slice(0, 4)}`
    : dateValue;
  const dateTimes = buildRequestDateTimes(
    timeZones,
    values.timeZoneId,
    dateValue,
    values.start_time,
    values.end_time,
  );
  const requestName = [
    values.name?.trim(),
    values.retailer?.trim(),
    dateForName,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    name: requestName || values.name,
    date: dateTimes.date,
    startTime: dateTimes.startTime,
    endTime: dateTimes.endTime,
    address: values.address,
    coordinates: [Number(values.latitude), Number(values.longitude)],
    stateId: values.stateId,
    requestorEmail: values.requestorEmail,
    // Backend still requires client fields even though UI no longer collects them.
    clientName: CLIENT_PLACEHOLDER.name,
    clientEmail: CLIENT_PLACEHOLDER.email,
    distributorId: values.distributorId || null,
    billingEntityId: values.billingEntityId || null,
    distributorName: values.distributor ?? "",
    distributorEmail: values.distributorEmail ?? "",
    retailerId: values.retailerId || null,
    retailerName: values.retailer ?? "",
    retailerAddress: values.retailerAddress ?? "",
    retailerStoreContact: values.retailerStoreContact,
    storeManagerName: values.storeManagerName,
    storeManagerPhone: values.storeManagerContact,
    requestTypeId: values.request_type,
    timezoneId: values.timeZoneId,
    notes: values.notes ?? "",
    products: values.skus.map((id) => ({
      productId: id,
    })),
    details: [
      {
        isTableNeeded,
        tableSize: isTableNeeded
          ? Number(values.details?.[0]?.tableSize)
          : null,
      },
    ],
  };
}
