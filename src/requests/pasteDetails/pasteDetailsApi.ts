import { commitMutation } from "relay-runtime";
import environment from "@/api/relay/environment";
import { ParseRequestDetailsMutation } from "@/api/mutations/ParseRequestDetailsMutation";
import type { ParseRequestDetailsMutation as ParseRequestDetailsMutationType } from "@api/mutations/__generated__/ParseRequestDetailsMutation.graphql";
import type { PastedDraft } from "./pasteDetails";

export type ParseResult = {
  ok: boolean;
  /** Why nothing came back; "" on success. */
  message: string;
  /** The text was cut, or held more visits than were returned. */
  truncated: boolean;
  drafts: PastedDraft[];
};

/**
 * Send pasted text to be read into drafts. The text goes in this one request
 * and is not kept anywhere: not in the browser's storage and not on the
 * server. Nothing is created.
 */
export function parseRequestDetails(tenantId: string, text: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    commitMutation<ParseRequestDetailsMutationType>(environment, {
      mutation: ParseRequestDetailsMutation,
      variables: { tenantId, text },
      onCompleted: (response, errors) => {
        if (errors && errors.length > 0) {
          reject(new Error(errors[0]?.message ?? "Request failed."));
          return;
        }
        const out = response.parseRequestDetails;
        resolve({
          ok: out.ok,
          message: out.message,
          truncated: out.truncated,
          drafts: out.drafts.map((d) => ({
            ...d,
            products: d.products.map((p) => ({ uuid: String(p.uuid), name: p.name })),
            unmatchedProducts: [...d.unmatchedProducts],
            couldNotRead: [...d.couldNotRead],
          })),
        });
      },
      onError: reject,
    });
  });
}
