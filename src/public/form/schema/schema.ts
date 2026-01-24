import * as yup from "yup";

export const sparkFormSchema = yup.object({
  distributorId: yup.string().optional().nullable(),
  retailerId: yup.string().optional().nullable(),
  locationId: yup.string().optional().nullable(),
  address: yup.string().required("Address is required"),
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
  distributor: yup
    .string()
    .when("distributorId", {
      is: (value: string | null | undefined) => !value,
      then: (schema) => schema.required("Distributor is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  distributorEmail: yup
    .string()
    .email("Invalid email format")
    .when("distributorId", {
      is: (value: string | null | undefined) => !value,
      then: (schema) => schema.required("Distributor email is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  start_time: yup.string().required("Start time is required"),
  name: yup.string().required("Name is required"),
  requestorEmail: yup
    .string()
    .email("Invalid email format")
    .required("Requestor email is required"),
  skus: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one product")
    .required("Products are required"),
  request_type: yup.string().required("Request type is required"),
  retailer: yup
    .string()
    .when("retailerId", {
      is: (value: string | null | undefined) => !value,
      then: (schema) => schema.required("Retailer is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  retailerAddress: yup.string().when("retailerId", {
    is: (value: string | null | undefined) => !value,
    then: (schema) => schema.required("Retailer address is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  retailerStoreContact: yup.string().required("Retailer store contact is required"),
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
  // tenant: yup.string().required("Tenant is required"),
  timeZoneId: yup.string().required("Time zone is required"),
});

export type SparkFormData = yup.InferType<typeof sparkFormSchema>;
