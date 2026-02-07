import { useSparkForm } from "../hooks/useSparkForm";
import { useState } from "react";
import FormWizard from "./FormWizard";
import SideSummary from "./SideSummary";
import { Step1Basic, Step2Products, Step4Details, Step3Clients } from "./steps";
import { calculateProgress } from "../utils/calculateProgress";
import { stepFields } from "../utils/stepValidation";
import { useSparkSubmit } from "../hooks";

interface SparkFormProps {
  requestTypes: {
    id: string;
    name: string;
  }[];
  states: {
    id: string;
    name: string;
  }[];
  onStateSearch: (value: string) => void;
  onStateChange: (value: string) => void;
  onRetailerSearch: (value: string) => void;
  distributors: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  }[];
  retailers: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  }[];
  products: {
    id: string;
    name: string;
    image?: string | null;
    productType: {
      id: string;
      name: string;
    };
  }[];
  productTypes: {
    id: string;
    name: string;
  }[];
  tenantId: string;
  timeZones: {
    id: string;
    name: string;
    code: string;
    offset: number;
  }[];
}

export default function SparkForm(props: SparkFormProps) {
  const {
    // clients,
    requestTypes,
    states,
    onStateSearch,
    onStateChange,
    onRetailerSearch,
    products,
    productTypes,
    distributors,
    retailers,
    tenantId,
    timeZones,
  } = props;

  const { control, watch, reset, trigger, setValue } = useSparkForm();
  const values = watch();
  const [resetSignal, setResetSignal] = useState(0);

  const { handleSubmit, loading } = useSparkSubmit(tenantId, () => {
    reset();
    setResetSignal(Math.random());
  }, timeZones);

  // useEffect(() => {
  //   if (tenantId) setValue("tenant", tenantId);
  // }, [tenantId, setValue]);

  const steps = [
    {
      title: "Basic Information",
      description: "Tell us about the visit",
      validate: () => trigger(stepFields.step1),
      content: (
        <Step1Basic
          control={control}
          timeZones={timeZones}
          setValue={setValue}
        />
      ),
    },
    {
      title: "Products",
      description: "Choose SKUs",
      validate: () => trigger(stepFields.step2),
      content: (
        <Step2Products
          control={control}
          products={products}
          productTypes={productTypes}
        />
      ),
    },
    {
      title: "Client Details",
      description: "Select distributor, and retailer",
      validate: () => trigger(stepFields.step3),
      content: (
        <Step3Clients
          control={control}
          setValue={setValue}
          requestTypes={requestTypes}
          states={states}
          onStateSearch={onStateSearch}
          onStateChange={onStateChange}
          onRetailerSearch={onRetailerSearch}
          distributors={distributors}
          retailers={retailers}
        />
      ),
    },
    {
      title: "Extra Details",
      description: "Optional details",
      validate: () => trigger(stepFields.step4),
      content: <Step4Details control={control} values={values} />,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <FormWizard
          steps={steps}
          onSubmit={() => handleSubmit(values)}
          resetSignal={resetSignal}
          loadingSubmit={loading}
        />
      </div>

      <SideSummary
        values={values}
        progress={calculateProgress(values)}
        productsFull={products}
        timeZones={timeZones}
      />
    </div>
  );
}
