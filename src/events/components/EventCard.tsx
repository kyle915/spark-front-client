import React from "react";
import { Link } from "react-router";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import type { EventUuidQuery$data } from "@/api/queries/__generated__/EventUuidQuery.graphql";
import { formatDate, formatTime } from "../../utils";
import LocationMap from "@/shared/LocationMap";

type EventCardEvent = NonNullable<EventUuidQuery$data["event"]>;

interface Props {
  event: EventCardEvent;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-base-content/50">
      {label}
    </p>
    <div className="text-sm md:text-base font-medium">{value}</div>
  </div>
);

const EventCard: React.FC<Props> = ({ event }) => {
  const {
    uuid,
    name,
    startTime,
    endTime,
    address,
    isNational,
    notes,
    request,
    eventType,
    status,
  } = event;

  return (
    <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
      <div className="p-8 md:p-10 space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-base-100/20">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-base-content/40">
              {eventType?.name ?? "Event Details"}
            </p>
            <h1 className="text-3xl font-semibold mt-1">{name}</h1>
            <p className="text-base-content/70 text-sm mt-2">
              {request?.retailer?.name
                ? `Scheduled for ${request.retailer.name}`
                : "Review the event information and its related request."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Link
              to={`/event/edit/${uuid}`}
              className="btn btn-sm btn-ghost gap-2 border border-base-content/20"
            >
              <PencilSquareIcon className="w-4 h-4" />
              Edit
            </Link>
            <div className="flex items-center gap-3">
              <span
                className={`badge badge-lg ${
                  isNational ? "badge-success" : "badge-ghost"
                }`}
              >
                {isNational ? "National" : "Local"}
              </span>
              <span className="badge badge-lg badge-primary">
                {status?.name ?? "No status"}
              </span>
            </div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-lg">Summary</p>
            {request?.requestType?.name && (
              <span className="badge badge-outline">
                {request.requestType.name}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Notes" value={notes ?? "No notes available"} />
            <Field
              label="Location"
              value={
                <div className="space-y-1">
                  <p>{address}</p>
                  {request?.address && request.address !== address && (
                    <p className="text-xs text-base-content/70">
                      Request address: {request.address}
                    </p>
                  )}
                </div>
              }
            />
          </div>
        </div>

        {/* SCHEDULE */}
        <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
          <p className="font-semibold text-lg">Schedule</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label="Start" value={formatTime(startTime ?? null)} />
            <Field label="End" value={formatTime(endTime ?? null)} />
          </div>
        </div>

        {/* REQUEST SECTION */}
        <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-lg">Associated Request</p>
            {request?.status?.name && (
              <span className="badge badge-info badge-lg">
                {request.status.name}
              </span>
            )}
          </div>

          {request ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Name" value={request.name ?? "N/A"} />
                <Field
                  label="Date"
                  value={`${formatDate(request.date) ?? "N/A"}`}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field
                  label="Distributor"
                  value={request.distributor?.name ?? "N/A"}
                />
                <Field
                  label="Retailer"
                  value={request.retailer?.name ?? "N/A"}
                />
                <Field
                  label="Request Type"
                  value={request.requestType?.name ?? "N/A"}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-base-content/70">
              No associated request to display.
            </p>
          )}
        </div>

        {/* LOCATION MAP */}
        <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-lg">Event Location</p>
            <div className="text-xs text-base-content/70">
              {request?.coordinates
                ? `${request.coordinates[0]?.toString() ?? "-"}, ${
                    request.coordinates[1]?.toString() ?? "-"
                  }`
                : "No coordinates provided"}
            </div>
          </div>
          <LocationMap
            coordinates={request?.coordinates ?? null}
            label={request?.name ?? name}
            address={request?.address ?? address ?? null}
          />
        </div>
      </div>
    </div>
  );
};

export default EventCard;
