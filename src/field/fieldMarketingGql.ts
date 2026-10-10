/** Authed GraphQL POST for the field marketing (Plans) screens. */
export async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(planErrorMessage("network"));
  }
  let json: { data?: T; errors?: Array<{ message?: string }> };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Spark didn't answer (${res.status}). Try again.`);
  }
  if (json.errors?.length) {
    throw new Error(planErrorMessage(json.errors[0]?.message));
  }
  return json.data as T;
}

/** Plain-English Plans error. Plan validation messages already are; the rest get named. */
export function planErrorMessage(raw: string | null | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return "Spark couldn't save that. Try again.";
  if (message === "network") {
    return "Couldn't reach Spark. Check your connection and try again.";
  }
  if (/authentication required|signature has expired|invalid token|token (has )?expired/i.test(message)) {
    return "Your sign-in expired. Sign out, sign back in, and try again.";
  }
  if (/not a member of this tenant|returned more than one tenanteduser/i.test(message)) {
    return "Your login isn't linked to Torch THC correctly. Ask Ignite to check your access.";
  }
  if (/^Field marketing is for the brand team/i.test(message)) {
    return "This login is a brand ambassador account, so it can't add plans. Ask Ignite for a Torch client login.";
  }
  return message;
}
