import { commitMutation, fetchQuery, graphql } from "react-relay";
import environment from "@/api/relay/environment";
import type { legalStatusQuery } from "./__generated__/legalStatusQuery.graphql";
import type { legalStatusAcceptMutation } from "./__generated__/legalStatusAcceptMutation.graphql";

export type LegalStatus = NonNullable<legalStatusQuery["response"]["myLegalStatus"]>;

const statusQuery = graphql`
  query legalStatusQuery {
    myLegalStatus {
      required
      needsAcceptance
      currentVersion
      isUpdate
      changeSummary
      documents {
        document
        title
        path
        version
        acceptedVersion
        acceptedAt
        needsAcceptance
      }
    }
  }
`;

const acceptMutation = graphql`
  mutation legalStatusAcceptMutation($version: String!) {
    acceptLegalTerms(version: $version) {
      success
      message
      code
      status {
        required
        needsAcceptance
        currentVersion
        isUpdate
        changeSummary
        documents {
          document
          title
          path
          version
          acceptedVersion
          acceptedAt
          needsAcceptance
        }
      }
    }
  }
`;

/**
 * The caller's legal status, or null when it can't be read (network trouble,
 * or an API that doesn't have the field yet). Null means "don't block here":
 * the server enforces the gate on its own, and a blocked call flags it again.
 */
export async function fetchLegalStatus(): Promise<LegalStatus | null> {
  try {
    const data = await fetchQuery<legalStatusQuery>(environment, statusQuery, {}, {
      fetchPolicy: "network-only",
    }).toPromise();
    return data?.myLegalStatus ?? null;
  } catch {
    return null;
  }
}

export type AcceptResult = {
  success: boolean;
  message: string;
  code: string | null;
  status: LegalStatus | null;
};

export function acceptLegalTerms(version: string): Promise<AcceptResult> {
  return new Promise((resolve) => {
    commitMutation<legalStatusAcceptMutation>(environment, {
      mutation: acceptMutation,
      variables: { version },
      onCompleted: (res) => {
        const r = res.acceptLegalTerms;
        resolve({
          success: !!r?.success,
          message: r?.message ?? "",
          code: r?.code ?? null,
          status: r?.status ?? null,
        });
      },
      onError: () =>
        resolve({
          success: false,
          message: "Could not record your acceptance. Check your connection and try again.",
          code: "NETWORK",
          status: null,
        }),
    });
  });
}
