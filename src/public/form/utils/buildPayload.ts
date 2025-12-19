import { dateFormat } from "./toDate";
import type { SparkFormData } from "../schema/schema";
import type { CreateRequestInput } from "../types/CreateRequestByUrl";

const CLIENT_PLACEHOLDER = {
  name: "N/A",
  email: "no-client@placeholder.local",
};

export function buildPayload(values: SparkFormData): CreateRequestInput {
  const isTableNeeded =
    String(values.details?.[0]?.isTableNeeded).toLowerCase() === "true";

  const ensureSeconds = (time?: string | null) => {
    if (!time) return "";
    return time.split(":").length === 2 ? `${time}:00` : time;
  };

  const buildDateTime = (dateValue?: string | null, timeValue?: string | null) => {
    const formattedDate = dateFormat(dateValue ?? "");
    if (!formattedDate) return "";

    const timeWithSeconds = ensureSeconds(timeValue) || "00:00:00";
    return `${formattedDate} ${timeWithSeconds}`;
  };

  return {
    name: values.name,
    date: buildDateTime(values.date, "00:00"),
    startTime: buildDateTime(values.date, values.start_time),
    endTime: buildDateTime(values.date, values.end_time),
    address: values.address,
    coordinates: [Number(values.latitude), Number(values.longitude)],
    // Backend still requires client fields even though UI no longer collects them.
    clientName: CLIENT_PLACEHOLDER.name,
    clientEmail: CLIENT_PLACEHOLDER.email,
    distributorId: values.distributorId || null,
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
