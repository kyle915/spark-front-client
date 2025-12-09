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

  return {
    name: values.name,
    date: dateFormat(values.date),
    startTime: values.start_time,
    endTime: values.end_time,
    address: values.address,
    coordinates: [Number(values.latitude), Number(values.longitude)],
    // Backend still requires client fields even though UI no longer collects them.
    clientName: CLIENT_PLACEHOLDER.name,
    clientEmail: CLIENT_PLACEHOLDER.email,
    distributorName: values.distributor,
    distributorEmail: values.distributorEmail,
    retailerName: values.retailer,
    retailerAddress: values.retailerAddress,
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
