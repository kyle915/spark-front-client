import { useSparkForm } from "../hooks/useSparkForm";

import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormSelect from "@/shared/FormSelect";
import ProductSelector from "./ProductSelector";
import FormWizard from "./FormWizard";
import SideSummary from "./SideSummary";
import { calculateProgress } from "../helpers/calculateProgress";
import FormLocationPicker from "./FormLocationPicker";

interface SparkFormProps {
  // tenantSlug: string;
  clients: any[];
  requestTypes: any[];
  products: any[];
  // productTypes: any[];
  distributors: any[];
  retailers: any[];
}

export default function SparkForm({
  // tenantSlug,
  clients,
  requestTypes,
  products,
  // productTypes,
  distributors,
  retailers,
}: SparkFormProps) {
  const { control, getValues } = useSparkForm();

  // console.log("Rendering SparkForm for tenant:", tenantSlug);

  const onFinish = () => {
    console.log("FORM DATA:", getValues());
  };

  const steps = [
    {
      title: "Basic Information",
      description: "Tell us about the visit",
      content: (
        <div className="space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInputTime
              name="start_time"
              label="Start Time"
              control={control}
            />
            <FormInputTime name="end_time" label="End Time" control={control} />
          </div>

          <FormLocationPicker
            control={control}
            nameLat="latitude"
            nameLng="longitude"
            label="Select the visit location on the map"
          />
        </div>
      ),
    },

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
            }))}
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

            {/* <FormSelect
              name="product_type"
              label="Product Type"
              control={control}
              options={productTypes.map((pt) => ({
                value: pt.uuid,
                label: pt.name,
              }))}
            /> */}
          </div>
        </div>
      ),
    },

    {
      title: "Review & Submit",
      description: "Almost ready!",
      content: (
        <pre className="bg-base-200 p-4 rounded-xl text-xs">
          {JSON.stringify(getValues(), null, 2)}
        </pre>
      ),
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <FormWizard steps={steps} onFinish={onFinish} />
      </div>

      <SideSummary
        values={getValues()}
        progress={calculateProgress(getValues())}
      />
    </div>
  );
}
