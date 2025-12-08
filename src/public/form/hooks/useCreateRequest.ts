import { useState } from "react";
import { createRequestService } from "../../api/services/createRequestByUrl";
import type { CreateRequestWithDependenciesInput } from "../types/CreateRequestByUrl";

export function useCreateRequest({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function submit(input: CreateRequestWithDependenciesInput) {
    setLoading(true);
    setError(null);

    try {
      const data = await createRequestService(input, slug);
      setResult(data);
      return data;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    submit,
    loading,
    error,
    result,
  };
}
