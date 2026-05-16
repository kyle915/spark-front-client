import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { sparkFormSchema } from "../schema/schema";
import type { SparkFormData } from "../schema/schema";

export const useSparkForm = () =>
  useForm<SparkFormData>({
    mode: "onChange",
    resolver: yupResolver(sparkFormSchema) as Resolver<SparkFormData>,

    defaultValues: {
      isNationalRetailer: true,
      distributorId: "",
      retailerId: "",
      billingEntityId: "",
      stateId: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      date: "",
      details: [{ isTableNeeded: "false", tableSize: null }],
      distributor: "",
      distributorEmail: "",
      start_time: "",
      name: "",
      requestorEmail: "",
      request_type: "",
      retailer: "",
      retailerAddress: "",
      retailerStoreContact: "",
      end_time: "",
      storeManagerContact: "",
      storeManagerName: "",
      notes: "",
      // tenant: "",
      timeZoneId: "",
      skus: [],
    },
  });
