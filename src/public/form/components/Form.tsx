import { useSparkForm } from "../hooks/useSparkForm";

import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormTextarea from "@/shared/FormTextarea";
import FormSelect from "@/shared/FormSelect";

import ProductSelector from "./ProductSelector";

import FormWizard from "./FormWizard";
import SideSummary from "./SideSummary";

import { calculateProgress } from "../helpers/calculateProgress";

const PRODUCTS = [
  { id: "cranberry", name: "Cranberry", desc: "", img: "" },
  { id: "grape", name: "Grape", desc: "", img: "" },
  { id: "orange", name: "Orange", desc: "", img: "" },
  { id: "power", name: "Power", desc: "", img: "" },
];

const REFERENCES = {
  client: [
    { value: "1", label: "Client 1" },
    { value: "2", label: "Client 2" },
  ],
  distributor: [
    { value: "1", label: "Distributor 1" },
    { value: "2", label: "Distributor 2" },
  ],
  retailer: [
    { value: "1", label: "Retailer 1" },
    { value: "2", label: "Retailer 2" },
  ],
  request_type: [
    { value: "install", label: "Installation" },
    { value: "maintenance", label: "Maintenance" },
  ],
  status: [
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
  ],
  tenant: [
    { value: "hn", label: "Honduras" },
    { value: "ni", label: "Nicaragua" },
  ],
};

export default function SparkForm() {
  const { control, getValues } = useSparkForm();

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

          <FormTextarea name="address" label="Address" control={control} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInputText
              name="latitude"
              label="Latitude"
              type="number"
              control={control}
            />
            <FormInputText
              name="longitude"
              label="Longitude"
              type="number"
              control={control}
            />
          </div>
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
            products={PRODUCTS}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              name="client"
              label="Client"
              control={control}
              options={REFERENCES.client}
            />
            <FormSelect
              name="distributor"
              label="Distributor"
              control={control}
              options={REFERENCES.distributor}
            />
            <FormSelect
              name="retailer"
              label="Retailer"
              control={control}
              options={REFERENCES.retailer}
            />
            <FormSelect
              name="request_type"
              label="Request Type"
              control={control}
              options={REFERENCES.request_type}
            />
            <FormSelect
              name="status"
              label="Status"
              control={control}
              options={REFERENCES.status}
            />
            <FormSelect
              name="tenant"
              label="Tenant"
              control={control}
              options={REFERENCES.tenant}
            />
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
      {/* LEFT: FORM */}
      <div className="flex-1">
        <FormWizard steps={steps} onFinish={onFinish} />
      </div>

      {/* RIGHT: SUMMARY */}
      <SideSummary
        values={getValues()}
        progress={calculateProgress(getValues())}
      />
    </div>
  );
}
