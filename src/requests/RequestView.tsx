import Layout from "@/layout/Layout";
import { useParams, useLocation } from "react-router";
import { useLazyLoadQuery } from "react-relay";
import RequestCard from "./components/RequestCard";

import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";

const RequestViewContent = ({ uuid, from }: { uuid: string; from: string }) => {
  const { request } = useLazyLoadQuery<RequestUuidQueryType>(
    RequestUuidQuery,
    { uuid },
    { fetchPolicy: "store-and-network" },
  );

  if (!request) {
    return <Layout>Request not found</Layout>;
  }

  return (
    <Layout>
      <RequestCard request={request} backTo={from} />
    </Layout>
  );
};

const RequestView = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from ?? "/requests/list";

  if (!uuid) {
    return <Layout>Request not found</Layout>;
  }

  return <RequestViewContent uuid={uuid} from={from} />;
};

export default RequestView;
