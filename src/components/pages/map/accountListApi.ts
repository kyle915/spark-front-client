import { commitMutation, fetchQuery } from "relay-runtime";
import type { GraphQLTaggedNode, MutationParameters } from "relay-runtime";
import environment from "@/api/relay/environment";
import { AccountListQuery } from "@/api/queries/AccountListQuery";
import type { AccountListQuery as AccountListQueryType } from "@api/queries/__generated__/AccountListQuery.graphql";
import { SaveAccountListMutation } from "@/api/mutations/SaveAccountListMutation";
import type { SaveAccountListMutation as SaveAccountListMutationType } from "@api/mutations/__generated__/SaveAccountListMutation.graphql";
import { PlaceAccountListEntriesMutation } from "@/api/mutations/PlaceAccountListEntriesMutation";
import type { PlaceAccountListEntriesMutation as PlaceAccountListEntriesMutationType } from "@api/mutations/__generated__/PlaceAccountListEntriesMutation.graphql";
import { chunk, type ListEntry, type ListInput } from "./accountStores";

/** The server takes at most 2,000 rows per call; send far fewer at a time. */
const SAVE_CHUNK = 500;

function mutate<T extends MutationParameters>(
  mutation: GraphQLTaggedNode,
  variables: T["variables"],
): Promise<T["response"]> {
  return new Promise((resolve, reject) => {
    commitMutation<T>(environment, {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        if (errors && errors.length > 0) {
          reject(new Error(errors[0]?.message ?? "Request failed."));
        } else {
          resolve(response);
        }
      },
      onError: reject,
    });
  });
}

export async function fetchAccountList(tenantId: string): Promise<ListEntry[]> {
  const data = await fetchQuery<AccountListQueryType>(
    environment,
    AccountListQuery,
    { tenantId },
    { fetchPolicy: "network-only" },
  ).toPromise();
  return (data?.accountListEntries ?? []).map((e) => ({
    uuid: String(e.uuid),
    name: e.name,
    address: e.address,
    city: e.city,
    state: e.state,
    zip: e.zip,
    chain: e.chain,
    lat: e.lat,
    lng: e.lng,
    positionStatus: e.positionStatus,
  }));
}

export type SaveSummary = { added: number; duplicates: number; skipped: number };

export async function saveAccountList(
  tenantId: string,
  rows: ReadonlyArray<ListInput>,
): Promise<SaveSummary> {
  const out: SaveSummary = { added: 0, duplicates: 0, skipped: 0 };
  for (const accounts of chunk(rows, SAVE_CHUNK)) {
    const res = await mutate<SaveAccountListMutationType>(SaveAccountListMutation, {
      tenantId,
      accounts,
    });
    out.added += res.saveAccountList.added;
    out.duplicates += res.saveAccountList.duplicates;
    out.skipped += res.saveAccountList.skipped;
  }
  return out;
}

export type PlaceResult = {
  placed: number;
  notFound: number;
  remaining: number;
  lookupAvailable: boolean;
};

export async function placeAccountListEntries(
  tenantId: string,
  limit: number,
): Promise<PlaceResult> {
  const res = await mutate<PlaceAccountListEntriesMutationType>(
    PlaceAccountListEntriesMutation,
    { tenantId, limit },
  );
  return res.placeAccountListEntries;
}
