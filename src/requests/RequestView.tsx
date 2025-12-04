import Layout from "@/layout/Layout";
import { useParams } from "react-router";
import { useLazyLoadQuery } from "react-relay";
import RequestCard from "./components/RequestCard";

import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";

const RequestViewContent = ({ uuid }: { uuid: string }) => {
  const { request } = useLazyLoadQuery<RequestUuidQueryType>(RequestUuidQuery, {
    uuid,
  });

  if (!request) {
    return <Layout>Request not found</Layout>;
  }
  return (
    <Layout>
      <RequestCard request={request} />
    </Layout>
  );
};

const RequestView = () => {
  const { uuid } = useParams<{ uuid: string }>();

  if (!uuid) {
    return <Layout>Request not found</Layout>;
  }

  return <RequestViewContent uuid={uuid} />;
};

export default RequestView;
