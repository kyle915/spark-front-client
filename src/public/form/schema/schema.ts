import * as yup from "yup";

export const sparkFormSchema = yup.object({
  name: yup.string().required("Name is required"),
  date: yup.string().required("Date is required"),
  start_time: yup.string().required("Start time is required"),
  end_time: yup.string().required("End time is required"),
  address: yup.string().required("Address is required"),

  latitude: yup.string().default("").defined(),
  longitude: yup.string().default("").defined(),

  client: yup.string().required("Client is required"),
  distributor: yup.string().default("").defined(),
  retailer: yup.string().default("").defined(),

  request_type: yup.string().required("Request type is required"),
  status: yup.string().required("Status is required"),
  tenant: yup.string().required("Tenant is required"),
});

export type SparkFormData = yup.InferType<typeof sparkFormSchema>;
