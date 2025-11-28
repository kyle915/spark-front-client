import { useSparkForm } from "../hooks/useSparkForm";

import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormSelect from "@/shared/FormSelect";
import FormTextarea from "@/shared/FormTextarea";

import ProductSelector from "./ProductSelector";
import FormWizard from "./FormWizard";
import SideSummary from "./SideSummary";
import FormLocationPicker from "./FormLocationPicker";

import { useCreateRequest } from "../hooks/useCreateRequest";
import { calculateProgress } from "../utils/calculateProgress";
import { useEffect } from "react";
import { dateFormat } from "../utils/toDate";

interface SparkFormProps {
  clients: any[];
  requestTypes: any[];
  products: any[];
  productTypes: any[];
  distributors: any[];
  retailers: any[];
  tenantId: string;
}

export default function SparkForm({
  clients,
  requestTypes,
  products,
  productTypes,
  distributors,
  retailers,
  tenantId,
}: SparkFormProps) {
  const { control, watch, setValue } = useSparkForm();
  const { submit, loading, error, result } = useCreateRequest(
    tenantId ? { slug: tenantId } : { slug: "" }
  );

  useEffect(() => {
    if (tenantId) {
      setValue("tenant", tenantId);
    }
  }, [tenantId, setValue]);

  const values = watch();

  const onSubmit = async () => {
    const payload = {
      name: values.name,
      date: dateFormat(values.date),
      startTime: values.start_time,
      endTime: values.end_time,
      address: values.address,
      coordinates: [Number(values.latitude), Number(values.longitude)],
      clientId: values.client,
      distributorId: values.distributor,
      retailerId: values.retailer,
      requestTypeId: values.request_type,
      // tenantId: values.tenant,
      products: values.skus.map((id) => ({ productId: id })),
      details: [
        {
          isTableNeeded:
            values.details?.[0]?.isTableNeeded === "true" ||
            values.details?.[0]?.isTableNeeded === true,
          tableSize: values.details?.[0]?.tableSize
            ? Number(values.details[0].tableSize)
            : null,
        },
      ],
    };

    try {
      const created = await submit(payload);
      console.log("Created:", created);
      alert("Request successfully created!");
    } catch (err) {
      console.error(err);
      alert("Error: " + err);
    }
  };

  const steps = [
    // ---------------------------------------------------------
    // STEP 1: BASIC INFORMATION
    // ---------------------------------------------------------
    {
      title: "Basic Information",
      description: "Tell us about the visit",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInputText
            name="name"
            label="Full Name"
            control={control}
            rules={{ required: "Required" }}
          />

          <FormDatePicker
            name="date"
            label="Visit Date"
            control={control}
            rules={{ required: "Required" }}
          />

          <FormInputTime
            name="start_time"
            label="Start Time"
            control={control}
          />

          <FormInputTime name="end_time" label="End Time" control={control} />

          <div className="col-span-2">
            <FormLocationPicker
              control={control}
              nameLat="latitude"
              nameLng="longitude"
              label="Select visit location on the map"
            />
          </div>

          <div className="col-span-2">
            <FormTextarea name="address" label="Address" control={control} />
          </div>
        </div>
      ),
    },

    // ---------------------------------------------------------
    // STEP 2: PRODUCT SELECTION
    // ---------------------------------------------------------
    {
      title: "Products",
      description: "Choose the SKUs you want",
      content: (
        <div className="space-y-10">
          <ProductSelector
            name="skus"
            label="Choose SKUs"
            control={control}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              desc: "",
              img: "",
              productTypeId: p.productType.id,
            }))}
            productTypes={productTypes}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              name="client"
              label="Client"
              control={control}
              options={clients.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />

            <FormSelect
              name="distributor"
              label="Distributor"
              control={control}
              options={distributors.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
            />

            <FormSelect
              name="retailer"
              label="Retailer"
              control={control}
              options={retailers.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />

            <FormSelect
              name="request_type"
              label="Request Type"
              control={control}
              options={requestTypes.map((rt) => ({
                value: rt.id,
                label: rt.name,
              }))}
            />
          </div>
        </div>
      ),
    },

    // ---------------------------------------------------------
    // STEP 3: EXTRA DETAILS
    // ---------------------------------------------------------
    {
      title: "Extra Details",
      description: "Optional but recommended",
      content: (
        <div className="space-y-6">
          {/* <FormTextarea
            name="notes"
            label="Additional Notes (optional)"
            control={control}
          /> */}

          <FormSelect
            name="details.0.isTableNeeded"
            label="Table Needed?"
            control={control}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />

          {values.details?.[0]?.isTableNeeded === "true" && (
            <FormInputText
              name="details.0.tableSize"
              label="Table Size"
              control={control}
            />
          )}
        </div>
      ),
    },

    // ---------------------------------------------------------
    // STEP 4: REVIEW
    // ---------------------------------------------------------
    {
      title: "Review & Submit",
      description: "Almost ready!",
      content: (
        <pre className="bg-base-200 p-4 rounded-xl text-xs">
          {JSON.stringify(values, null, 2)}
        </pre>
      ),
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <FormWizard steps={steps} onSubmit={onSubmit} />
      </div>

      <SideSummary
        values={values}
        progress={calculateProgress(values)}
        productsFull={products}
      />
    </div>
  );
}
