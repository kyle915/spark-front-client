import { useParams } from "react-router";
import SparkFormLayout from "./layout/FormLayout";
import SparkForm from "./components/Form";
import { usePublicFormData } from "./hooks/usePublicFormData";

export default function SparkFormPage() {
  const { tenantSlug } = useParams();

  // Si todavía no hay tenant, no dispares Relay
  if (!tenantSlug) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  const {
    clients,
    requestTypes,
    products,
    // productTypes,
    distributors,
    retailers,
  } = usePublicFormData(tenantSlug!);

  console.log("SparkFormPage rendered for tenantSlug:", tenantSlug);
  console.log("Fetched data:", {
    clients,
    requestTypes,
    products,
    distributors,
    retailers,
  });

  return (
    <SparkFormLayout>
      <SparkForm
        clients={clients}
        requestTypes={requestTypes}
        products={products}
        // productTypes={productTypes}
        distributors={distributors}
        retailers={retailers}
      />
    </SparkFormLayout>
  );
}
