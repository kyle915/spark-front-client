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

import { calculateProgress } from "../helpers/calculateProgress";
import { useEffect } from "react";

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

  useEffect(() => {
    if (tenantId) {
      setValue("tenant", tenantId);
    }
  }, [tenantId, setValue]);

  const values = watch();

  const onFinish = () => {
    const finalPayload = {
      name: values.name,
      date: values.date,
      startTime: values.start_time,
      endTime: values.end_time,
      address: values.address,
      coordinates: [Number(values.latitude), Number(values.longitude)],
      clientId: values.client,
      distributorId: values.distributor,
      retailerId: values.retailer,
      requestTypeId: values.request_type,
      products: values.skus.map((id) => ({ productId: id })),
      details: values.details || [],
      tenantId: values.tenant,
    };

    console.log("FINAL MUTATION PAYLOAD:", finalPayload);
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
              id: p.uuid,
              name: p.name,
              desc: "",
              img: "",
              productTypeId: p.productType.uuid,
            }))}
            productTypes={productTypes}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              name="client"
              label="Client"
              control={control}
              options={clients.map((c) => ({
                value: c.uuid,
                label: c.name,
              }))}
            />

            <FormSelect
              name="distributor"
              label="Distributor"
              control={control}
              options={distributors.map((d) => ({
                value: d.uuid,
                label: d.name,
              }))}
            />

            <FormSelect
              name="retailer"
              label="Retailer"
              control={control}
              options={retailers.map((r) => ({
                value: r.uuid,
                label: r.name,
              }))}
            />

            <FormSelect
              name="request_type"
              label="Request Type"
              control={control}
              options={requestTypes.map((rt) => ({
                value: rt.uuid,
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

          {/* Ejemplo de detalles */}
          <FormSelect
            name="details.0.isTableNeeded"
            label="Table Needed?"
            control={control}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />

          {/* Size si isTableNeeded === true */}
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
        <FormWizard steps={steps} onFinish={onFinish} />
      </div>

      <SideSummary values={values} progress={calculateProgress(values)} />
    </div>
  );
}
