import React, { useMemo } from "react";
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
import {
  formatDate,
  formatTime,
  extractDatePart,
  extractTimePart,
  buildDateTimeWithOffset,
} from "@/utils";
import { MapPinHouseIcon } from "lucide-react";

type Event = NonNullable<EventUuidQuery$data["event"]>;

interface Props {
  event: Event;
}

type TimezoneInfo =
  | Event["timezone"]
  | NonNullable<Event["request"]>["timezone"]
  | null;

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
    coordinates,
    status,
    request,
  } = event;
  const eventTimezone: TimezoneInfo = request?.timezone ?? null;

  // const formatTimezone = (tz: TimezoneInfo) => {
  //   if (!tz) return "N/A";
  //   const sign = tz.offset >= 0 ? "+" : "-";
  //   const absOffsetMinutes = Math.abs(tz.offset);
  //   const hours = String(Math.floor(absOffsetMinutes / 60)).padStart(2, "0");
  //   const minutes = String(absOffsetMinutes % 60).padStart(2, "0");
  //   return `${tz.name}-${tz.code} (UTC${sign}${hours}:${minutes})`;
  // };

  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const browserOffsetMinutes = useMemo(
    () => -new Date().getTimezoneOffset(),
    [],
  );

  const ensureDateTimeWithOffset = (
    value: string | null,
    fallbackDate: string | null,
    tz: TimezoneInfo,
  ) => {
    if (!value) return null;
    const hasOffset = /([+-]\\d{2}:?\\d{2}|Z)$/.test(value);
    if (hasOffset) return value;

    const datePart =
      extractDatePart(value) ?? extractDatePart(fallbackDate) ?? null;
    const timePart = extractTimePart(value);
    if (
      !datePart ||
      !timePart ||
      tz?.offset === undefined ||
      tz?.offset === null
    )
      return value;

    return buildDateTimeWithOffset(datePart, timePart, tz.offset);
  };

  const formatLocalDate = (value: string | null) => {
    const normalized = ensureDateTimeWithOffset(
      value,
      request?.date ?? null,
      eventTimezone,
    );
    if (!normalized) return "-";
    const dateObj = new Date(normalized);
    if (Number.isNaN(dateObj.getTime())) return normalized;
    return new Intl.DateTimeFormat(undefined, {
      timeZone: browserTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  };

  const formatLocalDateTime = (value: string | null) => {
    const normalized = ensureDateTimeWithOffset(
      value,
      request?.date ?? null,
      eventTimezone,
    );
    if (!normalized) return "-";
    const dateObj = new Date(normalized);
    if (Number.isNaN(dateObj.getTime())) return normalized;
    return new Intl.DateTimeFormat(undefined, {
      timeZone: browserTimezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);
  };

  const formatBrowserTimezoneLabel = () => {
    const sign = browserOffsetMinutes >= 0 ? "+" : "-";
    const absOffsetMinutes = Math.abs(browserOffsetMinutes);
    const hours = String(Math.floor(absOffsetMinutes / 60)).padStart(2, "0");
    const minutes = String(absOffsetMinutes % 60).padStart(2, "0");
    return `${browserTimezone} (UTC${sign}${hours}:${minutes})`;
  };

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
                  badge badge-soft badge-lg gap-2 font-semibold
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
                <span className="badge badge-soft badge-outline badge-info badge-lg font-medium">
                  {eventType.name}
                </span>
              )}

              {/* SCOPE */}
              <span className="badge badge-soft badge-outline badge-info badge-lg font-medium">
                <MapPinHouseIcon className="w-4 h-4" />
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-stretch">
          {/* BASIC INFORMATION */}
          <div className="xl:col-span-2 space-y-8">
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
          </div>

          {/* EVENT + REQUEST DETAILS */}
          <div className="xl:col-span-2 space-y-8">
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

          {/* TIMEZONE INFORMATION */}
          <div className="xl:col-span-4 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Your current timezone</p>
                <span className="badge badge-outline">
                  {formatBrowserTimezoneLabel()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase opacity-60">
                    Date (your zone)
                  </p>
                  <p className="font-medium">
                    {formatLocalDate(event.startTime ?? null)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">
                    Start (your zone)
                  </p>
                  <p className="font-medium">
                    {formatLocalDateTime(event.startTime ?? null)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= PRODUCTS ================= */}
          <div className="xl:col-span-4 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Products</p>

              {request?.products && request.products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {request.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 rounded-xl bg-base-200/70 border border-base-100/20 p-4 hover:shadow-md transition"
                    >
                      {/* IMAGE / PLACEHOLDER */}
                      <div className="w-14 h-14 rounded-lg bg-base-100/70 flex items-center justify-center">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <TagIcon className="w-6 h-6 opacity-40" />
                        )}
                      </div>

                      {/* INFO */}
                      <div className="flex flex-col gap-1">
                        <p className="font-medium leading-tight">
                          {product.name}
                        </p>

                        {product.productType?.name && (
                          <span className="badge badge-soft badge-outline badge-info w-fit text-xs">
                            {product.productType.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-60">
                  No products associated with this request.
                </p>
              )}
            </div>
          </div>

          {/* LOCATION INFORMATION */}
          <div className="xl:col-span-4 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Location Information</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs uppercase opacity-60">Retailer State</p>
                  <p className="font-medium">
                    {request?.retailer?.location?.state?.name ??
                      "No retailer state"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">
                    Retailer Location
                  </p>
                  <p className="font-medium">
                    {request?.retailer?.location?.name ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Retailer</p>
                  <p className="font-medium">
                    {request?.retailer?.name ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">
                    Distributor State
                  </p>
                  <p className="font-medium">
                    {request?.distributor?.location?.state?.name ??
                      "No distributor state"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">
                    Distributor Location
                  </p>
                  <p className="font-medium">
                    {request?.distributor?.location?.name ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase opacity-60">Distributor</p>
                  <p className="font-medium">
                    {request?.distributor?.name ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Location</p>
                <span className="text-xs opacity-60">
                  {request?.coordinates
                    ? `${request.coordinates[0]}, ${request.coordinates[1]}`
                    : "—"}
                </span>
              </div>

              <LocationMap
                coordinates={coordinates ?? null}
                label={name ?? "Event Location"}
                address={address ?? null}
              />

              <p className="text-xs text-center opacity-60 mt-4">
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
