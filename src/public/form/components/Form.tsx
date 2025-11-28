import { useSparkForm } from "../hooks/useSparkForm";

import { useAlertStore } from "@store/alertStore";
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
import { useEffect, useState } from "react";
import { dateFormat } from "../utils/toDate";
import type { SparkFormData } from "../schema/schema";
import type { FieldPath } from "react-hook-form";

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
  const { control, watch, setValue, reset, trigger } = useSparkForm();
  const [resetSignal, setResetSignal] = useState(0);
  const { submit, loading } = useCreateRequest(
    tenantId ? { slug: tenantId } : { slug: "" }
  );

  const { showAlert } = useAlertStore();

  useEffect(() => {
    if (tenantId) {
      setValue("tenant", tenantId);
    }
  }, [tenantId, setValue]);

  const values = watch();

  // STEP VALIDATION MAP
  const stepFields: Record<string, FieldPath<SparkFormData>[]> = {
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

  const onSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) return;

    const isTableNeeded =
      String(values.details?.[0]?.isTableNeeded).toLowerCase() === "true";

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
      products: values.skus.map((id) => ({ productId: id })),
      details: [
        {
          isTableNeeded,
          tableSize: isTableNeeded
            ? Number(values.details?.[0]?.tableSize)
            : null,
        },
      ],
    };

    try {
      await submit(payload);
      showAlert("Request created successfully!", "success");

      // RESET CORRECTO
      reset({
        name: "",
        date: "",
        start_time: "",
        end_time: "",
        latitude: undefined,
        longitude: undefined,
        address: "",
        skus: [],
        client: "",
        distributor: "",
        retailer: "",
        request_type: "",
        details: [{ isTableNeeded: "false", tableSize: 0 }],
        tenant: tenantId ?? "",
      });

      setResetSignal(Math.random());
    } catch (err) {
      showAlert("Error creating request: " + err, "error");
    }
  };

  const steps = [
    {
      title: "Basic Information",
      description: "Tell us about the visit",
      validate: () => trigger(stepFields.step1),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInputText name="name" label="Full Name" control={control} />
          <FormDatePicker name="date" label="Visit Date" control={control} />

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
              label="Select visit location"
            />
          </div>

          <div className="col-span-2">
            <FormTextarea name="address" label="Address" control={control} />
          </div>
        </div>
      ),
    },

    {
      title: "Products",
      description: "Choose your SKUs",
      validate: () => trigger(stepFields.step2),
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
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
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
              options={retailers.map((r) => ({ value: r.id, label: r.name }))}
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

    {
      title: "Extra Details",
      description: "Optional information",
      validate: () => trigger(stepFields.step3),
      content: (
        <div className="space-y-6">
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
              type="number"
              control={control}
            />
          )}
        </div>
      ),
    },

    {
      title: "Review & Submit",
      description: "Almost done! Review your information",
      content: <pre>{JSON.stringify(values, null, 2)}</pre>,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <FormWizard
          steps={steps}
          onSubmit={onSubmit}
          resetSignal={resetSignal}
          loadingSubmit={loading}
        />
      </div>

      <SideSummary
        values={values}
        progress={calculateProgress(values)}
        productsFull={products}
        clients={clients}
        distributors={distributors}
        retailers={retailers}
      />
    </div>
  );
}
