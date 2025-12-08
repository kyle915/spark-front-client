import type { SparkFormData } from "../schema/schema";

export function calculateProgress(values: SparkFormData): number {
  // STEP 1 – Basic fields
  const step1: Array<keyof SparkFormData> = [
    "name",
    "date",
    "start_time",
    "end_time",
    "address",
    "latitude",
    "longitude",
    "timeZoneId",
  ];

  // STEP 3 – Client / Distributor / Retailer
  const step3: Array<keyof SparkFormData> = [
    "client",
    "clientEmail",
    "distributor",
    "distributorEmail",
    "retailer",
    "retailerAddress",
    "retailerStoreContact",
    "storeManagerName",
    "storeManagerContact",
    "request_type",
  ];

  let filled = 0;

  // STEP 1 checks
  step1.forEach((f) => {
    const v = values[f];
    if (v !== undefined && v !== null && v !== "") filled++;
  });

  // STEP 3 checks
  step3.forEach((f) => {
    const v = values[f];
    if (v !== undefined && v !== null && v !== "") filled++;
  });

  // PRODUCTS (SKUs)
  const hasProducts = Array.isArray(values.skus) && values.skus.length > 0;
  if (hasProducts) filled++;

  const totalRequired = step1.length + step3.length + 1;

  return (filled / totalRequired) * 100;
}
