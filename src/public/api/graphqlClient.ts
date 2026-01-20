type GraphQLErrorItem = {
  message: string;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

export async function gqlRequest<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(query: string, variables?: TVariables): Promise<TData> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("GraphQL HTTP Error:", text);
    throw new Error("Failed to reach GraphQL server.");
  }

  const json = (await res.json()) as GraphQLResponse<TData>;

  if (json.errors && json.errors.length > 0) {
    console.error("GraphQL Errors:", json.errors);
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error("GraphQL response returned no data.");
  }

  return json.data;
}
