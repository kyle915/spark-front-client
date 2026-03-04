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
import { formatDate, formatLocalDateTime, formatTime } from "@/utils";
import { MapPinHouseIcon } from "lucide-react";

type InfoItemProps = {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

function InfoItem({ label, value, Icon }: InfoItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase opacity-60">{label}</p>
      <p className="font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

type Event = NonNullable<EventUuidQuery$data["event"]>;

interface Props {
  event: Event;
  backTo?: string;
}

const EventCard: React.FC<Props> = ({ event, backTo }) => {
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

  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const browserOffsetMinutes = useMemo(
    () => -new Date().getTimezoneOffset(),
    [],
  );

  const formatEventLocalTime = (value: string | null) =>
    formatLocalDateTime(value, { timeZone: browserTimezone });

  const formatBrowserTimezoneLabel = () => {
    const sign = browserOffsetMinutes >= 0 ? "+" : "-";
    const absOffsetMinutes = Math.abs(browserOffsetMinutes);
    const hours = String(Math.floor(absOffsetMinutes / 60)).padStart(2, "0");
    const minutes = String(absOffsetMinutes % 60).padStart(2, "0");
    return `${browserTimezone} (UTC${sign}${hours}:${minutes})`;
  };
  const isNationalRetailer = Boolean(
    (request?.retailer as { isNational?: boolean } | null)?.isNational ??
      (event.retailer as { isNational?: boolean } | null)?.isNational,
  );
  const retailerDisplayName =
    request?.retailer?.name ?? event.retailer?.name ?? "—";

  return (
    <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
      <div className="p-8 md:p-10 space-y-8">
        {/* ================= BACK BUTTON ================= */}
        <div>
          <Link
            to={backTo ?? "/events/list"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-8 items-start">
          {/* BASIC INFORMATION */}
          <div className="col-span-12 space-y-8">
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
          <div className="col-span-12 xl:col-span-6 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Event Details</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem
                  label="Event Type"
                  value={eventType?.name ?? "Unknown"}
                  Icon={TagIcon}
                />

                <InfoItem
                  label="Status"
                  value={status?.name ?? "Unknown"}
                  Icon={CheckCircleIcon}
                />

                <InfoItem
                  label="Scope"
                  value={isNational ? "National" : "Local"}
                  Icon={MapPinHouseIcon}
                />

                <InfoItem
                  label="Associated Request"
                  value={request?.name ?? "—"}
                  Icon={ClipboardDocumentIcon}
                />

                <InfoItem
                  label="Request Type"
                  value={request?.requestType?.name ?? "—"}
                  Icon={TagIcon}
                />
              </div>
            </div>
          </div>

          {/* ================= EVENT NOTES ================= */}
          <div className="col-span-12 xl:col-span-6 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4">
              <p className="font-semibold text-lg">Event Notes</p>

              <div className="rounded-xl bg-base-200/70 border border-base-100/20 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {notes ?? "No notes provided."}
                </p>
              </div>
            </div>
          </div>

          {/* TIMEZONE INFORMATION */}
          <div className="col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Your current timezone</p>
                <span className="badge badge-outline max-w-full truncate">
                  {formatBrowserTimezoneLabel()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem
                  label="Event Start Time"
                  value={formatEventLocalTime(event.startTime ?? null)}
                  Icon={CalendarIcon}
                />

                <InfoItem
                  label="Event End Time"
                  value={formatEventLocalTime(event.endTime ?? null)}
                  Icon={CalendarIcon}
                />
              </div>
            </div>
          </div>

          {/* ================= PRODUCTS ================= */}
          <div className="col-span-12 space-y-8">
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
          <div className="col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Location Details</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isNationalRetailer ? (
                  <>
                    <InfoItem
                      label="Is National"
                      value="Yes"
                      Icon={MapPinIcon}
                    />
                    <InfoItem
                      label="Retailer"
                      value={retailerDisplayName}
                      Icon={BuildingOfficeIcon}
                    />
                  </>
                ) : (
                  <>
                    <InfoItem
                      label="Retailer"
                      value={retailerDisplayName}
                      Icon={BuildingOfficeIcon}
                    />

                    <InfoItem
                      label="Retailer Location"
                      value={request?.retailer?.location?.name ?? "—"}
                      Icon={MapPinIcon}
                    />

                    <InfoItem
                      label="Retailer State"
                      value={request?.retailer?.location?.state?.name ?? "—"}
                      Icon={MapPinIcon}
                    />
                  </>
                )}

                <div className="hidden md:block md:col-span-3" />

                <InfoItem
                  label="Distributor"
                  value={request?.distributor?.name ?? "—"}
                  Icon={UsersIcon}
                />

                <InfoItem
                  label="Distributor Location"
                  value={request?.distributor?.location?.name ?? "—"}
                  Icon={MapPinIcon}
                />

                <InfoItem
                  label="Address"
                  value={address ?? "—"}
                  Icon={MapPinIcon}
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 gap-2 p-6 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Location Map</p>
                <span className="text-xs opacity-60">
                  {request?.coordinates.length
                    ? `${request.coordinates[0] || ""}, ${request.coordinates[1] || ""}`
                    : "No coordinates provided"}
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
