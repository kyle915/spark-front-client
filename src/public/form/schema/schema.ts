import * as yup from "yup";

export const sparkFormSchema = yup.object({
  address: yup.string().required("Address is required"),
  clientEmail: yup
    .string()
    .email("Invalid email format")
    .required("Client email is required"),

  client: yup.string().required("Client is required"),
  latitude: yup
    .number()
    .typeError("Latitude is required")
    .required("Latitude is required"),
  longitude: yup
    .number()
    .typeError("Longitude is required")
    .required("Longitude is required"),

  date: yup.string().required("Date is required"),
  details: yup
    .array()
    .of(
      yup.object({
        isTableNeeded: yup.string().required(),
        tableSize: yup
          .number()
          .nullable()
          .when("isTableNeeded", {
            is: "true",
            then: (schema) =>
              schema
                .required("Table size is required")
                .min(1, "Invalid table size"),
            otherwise: (schema) => schema.notRequired(),
          }),
      })
    )
    .required("Details are required"),
  distributor: yup.string().required("Distributor is required"),
  distributorEmail: yup
    .string()
    .email("Invalid email format")
    .required("Distributor email is required"),
  start_time: yup.string().required("Start time is required"),
  name: yup.string().required("Name is required"),
  skus: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one product")
    .required("Products are required"),
  request_type: yup.string().required("Request type is required"),
  retailer: yup.string().required("Retailer is required"),
  retailerAddress: yup.string().required("Retailer address is required"),
  retailerStoreContact: yup
    .string()
    .required("Retailer store contact is required"),
  end_time: yup
    .string()
    .required("End time is required")
    .test(
      "is-after-start",
      "End time cannot be earlier than start time",
      function (value) {
        const { start_time } = this.parent;

        if (!start_time || !value) return true;

        const start = new Date(`1970-01-01T${start_time}:00`);
        const end = new Date(`1970-01-01T${value}:00`);

        return end >= start;
      }
    ),
  storeManagerName: yup.string().required("Manager name is required"),
  storeManagerContact: yup.string().required("Manager contact is required"),
  tenant: yup.string().required("Tenant is required"),
  timeZoneId: yup.string().required("Time zone is required"),
});

export type SparkFormData = yup.InferType<typeof sparkFormSchema>;
