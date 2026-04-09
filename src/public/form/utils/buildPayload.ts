import { dateFormat } from "./toDate";
import { buildDateTimeWithOffset } from "@/utils";
import type { SparkFormData } from "../schema/schema";
import type { CreateRequestInput } from "../types/CreateRequestByUrl";

const CLIENT_PLACEHOLDER = {
  name: "N/A",
  email: "no-client@placeholder.local",
};

type TimeZoneOption = {
  id: string;
  offset: number;
};

export function buildPayload(
  values: SparkFormData,
  timeZones: TimeZoneOption[] = [],
): CreateRequestInput {
  const isTableNeeded =
    String(values.details?.[0]?.isTableNeeded).toLowerCase() === "true";
  const timezone = timeZones.find((tz) => tz.id === values.timeZoneId) ?? null;
  const offsetMinutes = timezone?.offset ?? null;
  const dateValue = dateFormat(values.date ?? "");
  const dateForName = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? `${dateValue.slice(5, 7)}/${dateValue.slice(8, 10)}/${dateValue.slice(0, 4)}`
    : dateValue;
  const normalizedDate = dateValue
    ? buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes)
    : "";
  const requestName = [
    values.name?.trim(),
    values.retailer?.trim(),
    dateForName,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    name: requestName || values.name,
    date: normalizedDate,
    startTime:
      dateValue && values.start_time
        ? buildDateTimeWithOffset(dateValue, values.start_time, offsetMinutes)
        : "",
    endTime:
      dateValue && values.end_time
        ? buildDateTimeWithOffset(dateValue, values.end_time, offsetMinutes)
        : "",
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
