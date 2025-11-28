import { useState } from "react";
import { createRequestService } from "../../api/services/createRequestByUrl";

export function useCreateRequest({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function submit(input: any) {
    setLoading(true);
    setError(null);

    try {
      const data = await createRequestService(input, slug);
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message);
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
