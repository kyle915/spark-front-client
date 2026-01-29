type VerifyAccountResponse = {
    success: boolean;
    errors?: {
        nonFieldErrors?: Array<{ message?: string }>;
        [key: string]: unknown;
    } | null;
};

export async function verifyAccount(token: string) {
    const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `
                mutation VerifyAccount($input: VerifyAccountInput!) {
                    verifyAccount(input: $input) {
                        success
                        errors
                    }
                }
            `,
            variables: { input: { token } },
        }),
    });

    const { data, errors } = await res.json();

    if (errors?.length) {
        throw new Error(errors[0].message || "Error verifying account");
    }

    const result: VerifyAccountResponse | undefined = data?.verifyAccount;

    if (!result?.success) {
        const nonFieldError =
            result?.errors &&
            typeof result.errors === "object" &&
            "nonFieldErrors" in result.errors
                ? (result.errors as VerifyAccountResponse["errors"])?.nonFieldErrors?.[0]?.message
                : null;

        throw new Error(nonFieldError || "Could not verify the account.");
    }

    return result;
}
