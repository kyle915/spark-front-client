import { useCreateRequest } from "../hooks/useCreateRequest";
import { useAlertStore } from "@store/alertStore";
import { buildPayload } from "../utils/buildPayload";
import type { SparkFormData } from "../schema/schema";

type TimeZoneOption = {
  id: string;
  offset: number;
};

export function useSparkSubmit(
  tenantId: string,
  reset: () => void,
  timeZones: TimeZoneOption[] = [],
) {
  const { submit, loading } = useCreateRequest({ slug: tenantId });
  const { showAlert } = useAlertStore();

  const handleSubmit = async (values: SparkFormData) => {
    try {
      const payload = buildPayload(values, timeZones);
      await submit(payload);

      showAlert("Request created successfully!", "success");

      reset();
    } catch (err) {
      showAlert("Error creating request: " + err, "error");
    }
  };

  return { handleSubmit, loading };
}
