import type { SparkFormData } from "../schema/schema";
import type { FieldPath } from "react-hook-form";

export const stepFields: Record<string, FieldPath<SparkFormData>[]> = {
  step1: [
    "name",
    "date",
    "start_time",
    "end_time",
    "latitude",
    "longitude",
    "address",
  ],
  step2: ["skus"],
  step3: [
    "request_type",
    "client",
    "clientEmail",
    "distributor",
    "distributorEmail",
    "retailer",
    "retailerAddress",
    "retailerStoreContact",
    "storeManagerName",
    "storeManagerContact",
  ],
  step4: ["details.0.isTableNeeded", "details.0.tableSize"],
};
