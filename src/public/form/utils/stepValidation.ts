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
  step2: ["skus", "client", "distributor", "retailer", "request_type"],
  step3: ["details.0.isTableNeeded", "details.0.tableSize"],
};
