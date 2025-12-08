import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { sparkFormSchema } from "../schema/schema";
import type { SparkFormData } from "../schema/schema";

export const useSparkForm = () =>
  useForm<SparkFormData>({
    resolver: yupResolver(sparkFormSchema),

    defaultValues: {
      address: "",
      clientEmail: "",
      client: "",
      latitude: undefined,
      longitude: undefined,
      date: "",
      details: [{ isTableNeeded: "false", tableSize: null }],
      distributor: "",
      distributorEmail: "",
      start_time: "",
      name: "",
      request_type: "",
      retailer: "",
      retailerAddress: "",
      retailerStoreContact: "",
      end_time: "",
      storeManagerContact: "",
      storeManagerName: "",
      tenant: "",
      timeZoneId: "",
      skus: [],
    },
  });
