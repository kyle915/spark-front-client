import { useCreateRequest } from "../hooks/useCreateRequest";
import { useAlertStore } from "@store/alertStore";
import { buildPayload } from "../utils/buildPayload";
import type { SparkFormData } from "../schema/schema";

export function useSparkSubmit(tenantId: string, reset: () => void) {
  const { submit, loading } = useCreateRequest({ slug: tenantId });
  const { showAlert } = useAlertStore();

  const handleSubmit = async (values: SparkFormData) => {
    try {
      const payload = buildPayload(values);
      await submit(payload);

      showAlert("Request created successfully!", "success");

      reset();
    } catch (err) {
      showAlert("Error creating request: " + err, "error");
    }
  };

  return { handleSubmit, loading };
}
