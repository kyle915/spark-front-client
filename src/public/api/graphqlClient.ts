export async function gqlRequest<T>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Authorization si hace falta
    },
    body: JSON.stringify({ query, variables }),
  });

  // Si la respuesta no es JSON, captura el error.
  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    const text = await res.text();
    console.error("GraphQL raw response:", text);
    throw new Error("El servidor devolvió una respuesta inválida.");
  }

  if (json.errors) {
    console.error("GraphQL Error:", json.errors);
    throw new Error(json.errors[0].message);
  }

  return json.data;
}
