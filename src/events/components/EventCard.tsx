import React from "react";
import { Link } from "react-router";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UsersIcon,
  TagIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import type { EventUuidQuery$data } from "@/api/queries/__generated__/EventUuidQuery.graphql";
import LocationMap from "@/shared/LocationMap";
import { formatDate, formatTime } from "@/utils";

type Event = NonNullable<EventUuidQuery$data["event"]>;

interface Props {
  event: Event;
}

const EventCard: React.FC<Props> = ({ event }) => {
  const {
    uuid,
    name,
    startTime,
    endTime,
    address,
    notes,
    isNational,
    eventType,
    status,
    request,
  } = event;

  return (
    <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
      <div className="p-8 md:p-10 space-y-8">
        {/* ================= BACK BUTTON ================= */}
        <div>
          <Link
            to="/events/list"
            className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to list
          </Link>
        </div>

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-base-100/20">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-base-content/40">
              Event
            </p>
            <h1 className="text-3xl font-semibold mt-1">
              {name ?? "Untitled Event"}
            </h1>
            <p className="text-base-content/70 text-sm mt-2">
              Scheduled for{" "}
              <span className="font-semibold">
                {request?.retailer?.name ?? "this account"}
              </span>
              .
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

            <div className="flex items-center gap-2 flex-wrap">
              {/* STATUS */}
              <span
                className={`
                  badge badge-lg gap-2 font-semibold
                  ${
                    status?.name === "Pending"
                      ? "badge-warning"
                      : status?.name === "Approved"
                      ? "badge-success"
                      : status?.name === "Cancelled"
                      ? "badge-error"
                      : "badge-neutral"
                  }
                `}
              >
                <CheckCircleIcon className="w-4 h-4" />
                {status?.name ?? "Unknown"}
              </span>

              {/* EVENT TYPE */}
              {eventType?.name && (
                <span className="badge badge-outline badge-lg font-medium">
                  {eventType.name}
                </span>
              )}

              {/* SCOPE */}
              <span className="badge badge-outline badge-lg font-medium">
                {isNational ? "National" : "Local"}
              </span>
            </div>
          </div>
        </div>

        {/* ================= QUICK INFO ================= */}
        <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-base-300/50 border border-base-100/20 px-6 py-4 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 opacity-60" />
            <span className="font-medium">{formatDate(startTime ?? null)}</span>
          </div>

          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 opacity-60" />
            <span className="font-medium">
              {formatTime(startTime ?? null)} – {formatTime(endTime ?? null)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-4 h-4 opacity-60" />
            <span className="font-medium">
              {request?.retailer?.name ?? "Unknown"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 opacity-60" />
            <span className="font-medium">{address ?? "—"}</span>
          </div>
        </div>

        {/* ================= MAIN GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            {/* BASIC INFORMATION */}
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Basic Information</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase opacity-60">Account Name</p>
                  <p className="font-medium flex items-center gap-2">
                    <BuildingOfficeIcon className="w-4 h-4 opacity-60" />
                    {request?.retailer?.name ?? "Unknown"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Distributor</p>
                  <p className="font-medium flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 opacity-60" />
                    {request?.distributor?.name ?? "Unknown"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Address</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 opacity-60" />
                    {address ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Notes</p>
                  <p className="font-medium">{notes ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* EVENT + REQUEST DETAILS */}
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Event & Request Details</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase opacity-60">Event Type</p>
                  <p className="font-medium flex items-center gap-2">
                    <TagIcon className="w-4 h-4 opacity-60" />
                    {eventType?.name ?? "Unknown"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Event Status</p>
                  <p className="font-medium flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 opacity-60" />
                    {status?.name ?? "Unknown"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">
                    Associated Request
                  </p>
                  <p className="font-medium flex items-center gap-2">
                    <ClipboardDocumentIcon className="w-4 h-4 opacity-60" />
                    {request?.name ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Request Type</p>
                  <p className="font-medium flex items-center gap-2">
                    <TagIcon className="w-4 h-4 opacity-60" />
                    {request?.requestType?.name ?? "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT / MAP */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4 sticky top-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Location</p>
                <span className="text-xs opacity-60">
                  {request?.coordinates
                    ? `${request.coordinates[0]}, ${request.coordinates[1]}`
                    : "—"}
                </span>
              </div>

              <LocationMap
                coordinates={request?.coordinates ?? null}
                label={name ?? "Event Location"}
                address={address ?? null}
              />

              <p className="text-xs text-center opacity-60">
                Tip: Use the Edit button to update event information or
                location.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
