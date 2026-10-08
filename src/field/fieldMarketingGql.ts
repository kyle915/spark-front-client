/** Authed GraphQL POST for the field marketing (Plans) screens. */
export async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  let json: { data?: T; errors?: Array<{ message?: string }> };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Spark didn't answer (${res.status}). Try again.`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}
