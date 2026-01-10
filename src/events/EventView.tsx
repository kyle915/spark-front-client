import Layout from "@/layout/Layout";
import { useParams } from "react-router";
import { useLazyLoadQuery } from "react-relay";
import EventCard from "@/events/components/EventCard";

import { EventUuidQuery } from "@api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@api/queries/__generated__/EventUuidQuery.graphql";

const EventViewContent = ({ uuid }: { uuid: string }) => {
  const { event } = useLazyLoadQuery<EventUuidQueryType>(EventUuidQuery, {
    uuid,
  });

  if (!event) {
    return <Layout>Request not found</Layout>;
  }

  return (
    <Layout>
      <EventCard event={event} />
    </Layout>
  );
};

const EventView = () => {
  const { uuid } = useParams<{ uuid: string }>();

  if (!uuid) {
    return <Layout>Event not found</Layout>;
  }

  return <EventViewContent uuid={uuid} />;
};

export default EventView;
