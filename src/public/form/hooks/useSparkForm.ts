import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { sparkFormSchema } from "../schema/schema";
import type { SparkFormData } from "../schema/schema";

export const useSparkForm = () =>
  useForm<SparkFormData>({
    resolver: yupResolver(sparkFormSchema),

    defaultValues: {
      name: "",
      date: "",
      start_time: "",
      end_time: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      client: "",
      distributor: "",
      retailer: "",
      request_type: "",
      skus: [],
      details: [{ isTableNeeded: "false", tableSize: 0 }],
      tenant: "",
    },
  });
