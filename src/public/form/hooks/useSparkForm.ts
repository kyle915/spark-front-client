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
      latitude: "",
      longitude: "",
      client: "",
      distributor: "",
      product_type: "",
      retailer: "",
      request_type: "",
      status: "",
      tenant: "",
    },
  });
