import {
    graphQLErrorMessage,
    guardrailFromStatus,
} from '@/api/relay/guardrailErrors';

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
    // Too many attempts: a bare 429, or a LOGIN_THROTTLED GraphQL error.
    const throttled = guardrailFromStatus(res.status, res.headers.get('Retry-After'));
    if (throttled) {
        throw new Error(
            'Too many sign-in attempts. Please wait a few minutes and try again.',
        );
    }
    const { data, errors } = await res.json();

    if (errors?.length) {
        throw new Error(graphQLErrorMessage(errors, 'Login failed'));
    }

    const result = data?.tokenAuth;
    if (!result?.success || result?.errors) {
        throw new Error(result?.errors?.nonFieldErrors?.[0]?.message || 'Login failed');
    }
    // const { token, user } = result;

    // localStorage.setItem('@token', token.token);

    return result;
}