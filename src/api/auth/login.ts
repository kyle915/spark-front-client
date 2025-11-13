export async function login(username: string, password: string) {
    const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
            mutation TokenAuth($input: ObtainJSONWebTokenInput!) {
              tokenAuth(input: $input) {
                success
                errors
                token {
                payload {
                    origIat
                    exp
                }
                token
                }
                user{
                    username
                    firstName
                    lastName
                    }
              }
            }
          `,
            variables: {
                input: {
                    username,
                    password,
                },
            },
        }),
    });
    const { data, errors } = await res.json();

    if (errors?.length) {
        throw new Error(errors[0].message);
    }

    const result = data?.tokenAuth;
    if (!result?.success || result?.errors) {
        throw new Error(result?.errors?.nonFieldErrors?.[0]?.message || 'Login failed');
    }
    // const { token, user } = result;

    // localStorage.setItem('@token', token.token);

    return result;
}