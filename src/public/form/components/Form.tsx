import { useSparkForm } from "../hooks/useSparkForm";
import { useEffect, useState } from "react";
import FormWizard from "./FormWizard";
import SideSummary from "./SideSummary";
import { Step1Basic, Step2Products, Step3Details } from "./steps";
import { calculateProgress } from "../utils/calculateProgress";
import { stepFields } from "../utils/stepValidation";
import { useSparkSubmit } from "../hooks";

interface SparkFormProps {
  clients: any[];
  requestTypes: any[];
  products: any[];
  productTypes: any[];
  distributors: any[];
  retailers: any[];
  tenantId: string;
}

export default function SparkForm(props: SparkFormProps) {
  const {
    clients,
    requestTypes,
    products,
    productTypes,
    distributors,
    retailers,
    tenantId,
  } = props;

  const { control, watch, setValue, reset, trigger } = useSparkForm();
  const values = watch();
  const [resetSignal, setResetSignal] = useState(0);

  const { handleSubmit, loading } = useSparkSubmit(tenantId, () => {
    reset();
    setResetSignal(Math.random());
  });

  useEffect(() => {
    if (tenantId) setValue("tenant", tenantId);
  }, [tenantId]);

  const steps = [
    {
      title: "Basic Information",
      description: "Tell us about the visit",
      validate: () => trigger(stepFields.step1),
      content: <Step1Basic control={control} />,
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
          clients={clients}
          distributors={distributors}
          retailers={retailers}
          requestTypes={requestTypes}
        />
      ),
    },
    {
      title: "Extra Details",
      description: "Optional details",
      validate: () => trigger(stepFields.step3),
      content: <Step3Details control={control} values={values} />,
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
        clients={clients}
        distributors={distributors}
        retailers={retailers}
      />
    </div>
  );
}
