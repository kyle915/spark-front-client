import Layout from "@/layout/Layout";
import { useParams, useLocation } from "react-router";
import { useLazyLoadQuery } from "react-relay";
import EventCard from "@/events/components/EventCard";

import { EventUuidQuery } from "@api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@api/queries/__generated__/EventUuidQuery.graphql";

const EventViewContent = ({ uuid, from }: { uuid: string; from: string }) => {
  const { event } = useLazyLoadQuery<EventUuidQueryType>(
    EventUuidQuery,
    { uuid },
    { fetchPolicy: "network-only" },
  );

  if (!event) {
    return <Layout>Event not found</Layout>;
  }

  return (
    <Layout>
      <EventCard event={event} backTo={from} />
    </Layout>
  );
};

const EventView = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from ?? "/requests/list";

  if (!uuid) {
    return <Layout>Event not found</Layout>;
  }

  return <EventViewContent uuid={uuid} from={from} />;
};

export default EventView;
