import { dateFormat } from "./toDate";

export function buildPayload(values: any) {
  const isTableNeeded =
    String(values.details?.[0]?.isTableNeeded).toLowerCase() === "true";

  return {
    name: values.name,
    date: dateFormat(values.date),
    startTime: values.start_time,
    endTime: values.end_time,
    address: values.address,
    coordinates: [Number(values.latitude), Number(values.longitude)],
    clientId: values.client,
    distributorId: values.distributor,
    retailerId: values.retailer,
    requestTypeId: values.request_type,
    products: values.skus.map((id: string) => ({ productId: id })),
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
