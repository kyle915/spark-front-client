import { commitMutation, fetchQuery } from "relay-runtime";
import type { GraphQLTaggedNode, MutationParameters } from "relay-runtime";
import environment from "@/api/relay/environment";
import { StoreNameSuggestionsQuery } from "@/api/queries/StoreNameSuggestionsQuery";
import type { StoreNameSuggestionsQuery as StoreNameSuggestionsQueryType } from "@api/queries/__generated__/StoreNameSuggestionsQuery.graphql";
import { DecideStoreNameGroupMutation } from "@/api/mutations/DecideStoreNameGroupMutation";
import type { DecideStoreNameGroupMutation as DecideStoreNameGroupMutationType } from "@api/mutations/__generated__/DecideStoreNameGroupMutation.graphql";
import { UndoStoreNameAliasMutation } from "@/api/mutations/UndoStoreNameAliasMutation";
import type { UndoStoreNameAliasMutation as UndoStoreNameAliasMutationType } from "@api/mutations/__generated__/UndoStoreNameAliasMutation.graphql";
import { CheckStoreNamesMutation } from "@/api/mutations/CheckStoreNamesMutation";
import type { CheckStoreNamesMutation as CheckStoreNamesMutationType } from "@api/mutations/__generated__/CheckStoreNamesMutation.graphql";
import type { StoreNameAccepted, StoreNameGroup } from "./storeNames";

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

export type StoreNameSuggestions = {
  groups: StoreNameGroup[];
  accepted: StoreNameAccepted[];
  maxGroupSize: number;
};

export async function fetchStoreNameSuggestions(
  tenantId: string,
): Promise<StoreNameSuggestions> {
  const data = await fetchQuery<StoreNameSuggestionsQueryType>(
    environment,
    StoreNameSuggestionsQuery,
    { tenantId },
    { fetchPolicy: "network-only" },
  ).toPromise();
  const s = data?.storeNameSuggestions;
  return {
    maxGroupSize: s?.maxGroupSize ?? 8,
    groups: (s?.groups ?? []).map((g) => ({
      groupKey: g.groupKey,
      canonicalName: g.canonicalName,
      kind: g.kind,
      source: g.source,
      reason: g.reason,
      canonicalRecords: g.canonicalRecords,
      affectedRecords: g.affectedRecords,
      names: g.names.map((n) => ({
        uuid: String(n.uuid),
        name: n.name,
        records: n.records,
        places: n.places,
      })),
    })),
    accepted: (s?.accepted ?? []).map((a) => ({
      uuid: String(a.uuid),
      name: a.name,
      canonicalName: a.canonicalName,
      records: a.records,
    })),
  };
}

export type Decision = { ok: boolean; message: string; affectedRecords: number };

export async function decideStoreNameGroup(input: {
  tenantId: string;
  groupKey: string;
  action: "accept" | "dismiss";
  canonicalName?: string;
  aliasUuids?: string[];
}): Promise<Decision> {
  const res = await mutate<DecideStoreNameGroupMutationType>(
    DecideStoreNameGroupMutation,
    {
      tenantId: input.tenantId,
      groupKey: input.groupKey,
      action: input.action,
      canonicalName: input.canonicalName ?? null,
      aliasUuids: input.aliasUuids ?? null,
    },
  );
  const out = res.decideStoreNameGroup;
  return { ok: out.ok, message: out.message, affectedRecords: out.affectedRecords };
}

export async function undoStoreNameAlias(
  tenantId: string,
  aliasUuid: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await mutate<UndoStoreNameAliasMutationType>(
    UndoStoreNameAliasMutation,
    { tenantId, aliasUuid },
  );
  return { ok: res.undoStoreNameAlias.ok, message: res.undoStoreNameAlias.message };
}

export type CheckResult = {
  ok: boolean;
  message: string;
  namesChecked: number;
  groupsFound: number;
};

export async function checkStoreNames(tenantId: string): Promise<CheckResult> {
  const res = await mutate<CheckStoreNamesMutationType>(CheckStoreNamesMutation, {
    tenantId,
  });
  const out = res.checkStoreNames;
  return {
    ok: out.ok,
    message: out.message,
    namesChecked: out.namesChecked,
    groupsFound: out.groupsFound,
  };
}
