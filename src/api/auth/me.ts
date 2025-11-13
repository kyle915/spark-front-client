import { fetchQuery } from 'relay-runtime';
import environment from '@api/relay/environment';
import { MeQuery } from '@api/queries/MeQuery';
import type { MeQuery as MeQueryType } from '@api/queries/__generated__/MeQuery.graphql';

type MeResponse = MeQueryType['response'];
export type MeUser = MeResponse['me'];

export async function fetchMe(): Promise<MeUser> {
    const data = await fetchQuery<MeQueryType>(environment, MeQuery, {}).toPromise();

    if (!data?.me) {
        throw new Error('User profile not found');
    }

    return data.me;
}
