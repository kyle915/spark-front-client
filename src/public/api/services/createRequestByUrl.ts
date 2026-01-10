import { gqlRequest } from "../graphqlClient";
import { CREATE_REQUEST_BY_URL } from "../mutations/createRequestByUrl";
import type {
  CreateRequestInput,
  CreateRequestResponse,
} from "../../form/types/CreateRequestByUrl";

export async function createRequestService(
  input: CreateRequestInput,
  requestUrlName: string
) {
  const res = await gqlRequest<CreateRequestResponse>(CREATE_REQUEST_BY_URL, {
    input,
    requestUrlName,
  });

  if (!res.createRequestByUrl.success) {
    throw new Error(
      res.createRequestByUrl.message || "Request creation failed"
    );
  }

  return res.createRequestByUrl.request;
}
