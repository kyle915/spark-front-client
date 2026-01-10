import type { RegisterFormFields } from "@/types/auth";

export async function register(input: RegisterFormFields) {
    const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
         mutation Register(
            $firstName: String!, 
            $email: String!, 
            $password1: String!, 
            $password2: String!
         ) {
            register(
                firstName: $firstName
                email: $email
                password1: $password1
                password2: $password2
            ) {
                success
                activationToken
                message
            }
            }
        `,
            variables: {
                firstName: input.firstName,
                email: input.email,
                password1: input.password1,
                password2: input.password2,
            },
        }),
    });

    const { data, errors } = await res.json();

    if (errors?.length) {
        throw new Error(errors[0].message);
    }

    const result = data?.register;
    if (!result?.success) {
        const errorMessage =
            result?.message ||
            'Registration failed';
        throw new Error(errorMessage);
    }

    return result;
}
