import React, { useEffect, useMemo, useState } from "react";
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
} from "@heroicons/react/24/outline";
import type { RequestUuidQuery$data } from "@api/queries/__generated__/RequestUuidQuery.graphql";
import LocationMap from "@shared/LocationMap";
import { useAuthStore } from "@/store/authStore";
import { formatDate, formatTime } from "@utils/index";

type InfoItemProps = {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

function InfoItem({ label, value, Icon }: InfoItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase opacity-60">{label}</p>
      <p className="font-medium flex items-start gap-2">
        <Icon className="w-4 h-4 opacity-60 shrink-0 mt-0.5" />
        <span className="break-words whitespace-normal">{value}</span>
      </p>
    </div>
  );
}

type Request = NonNullable<RequestUuidQuery$data["request"]>;

interface Props {
  request: Request;
  backTo?: string;
}

const RequestCard: React.FC<Props> = ({ request, backTo }) => {
  const tenantSlugFromStore = useAuthStore((state) => state.tenantSlug);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const browserOffsetMinutes = useMemo(
    () => -new Date().getTimezoneOffset(),
    [],
  );

  const ITEMS_PER_PAGE = 8;

  const productTypes = useMemo(() => {
    const types = request.products
      ?.map((p) => p.productType?.name)
      .filter(Boolean) as string[];

    return Array.from(new Set(types));
  }, [request.products]);

  const filteredProducts = React.useMemo(() => {
    if (productTypeFilter === "all") return request.products ?? [];

    return (request.products ?? []).filter(
      (p) => p.productType?.name === productTypeFilter,
    );
  }, [request.products, productTypeFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const paginatedProducts = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [productTypeFilter]);

  const formatLocalDate = (value: string | null) => {
    if (!value) return "-";
    const dateObj = new Date(value);
    if (Number.isNaN(dateObj.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      timeZone: browserTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  };

  const formatLocalTime = (value: string | null) => {
    if (!value) return "-";
    const dateObj = new Date(value);
    if (Number.isNaN(dateObj.getTime())) return value;
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

  const getUserLabel = (
    user:
      | { firstName?: string | null; lastName?: string | null }
      | null
      | undefined,
    fallback?: string | null,
  ) => {
    const first = user?.firstName?.trim();
    const last = user?.lastName?.trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    return fullName || fallback || "Unknown";
  };

  const createdByLabel = useMemo(() => {
    return getUserLabel(request.createdBy, request.requestorEmail);
  }, [request.createdBy, request.requestorEmail]);

  const approvedByLabel = useMemo(() => {
    if (!request.approvedBy) return "N/A";
    return getUserLabel(request.approvedBy);
  }, [request.approvedBy]);
  const rmmAssignedLabel = useMemo(() => {
    if (!request.rmmAsigned) return "No RMM assigned";
    return getUserLabel(request.rmmAsigned);
  }, [request.rmmAsigned]);
  const resolvedTenantSlug =
    request.tenant?.slug?.toLowerCase() ?? tenantSlugFromStore?.toLowerCase();
  const isCarblissTenant = resolvedTenantSlug === "carbliss";
  const isNationalRetailer = Boolean(
    (request.retailer as { isNational?: boolean } | null)?.isNational,
  );
  const retailerDisplayName = request.retailer?.name ?? request.retailerName ?? "—";
  const billingEntityName = (
    request as Request & {
      billingEntity?: { name?: string | null } | null;
    }
  ).billingEntity?.name;

  return (
    <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
      <div className="p-8 md:p-10 space-y-8">
        {/* ================= BACK BUTTON ================= */}
        <div>
          <Link
            to={backTo ?? "/requests/list"}
            className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to list
          </Link>
        </div>

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-base-100/20">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-base-content/40">
              Request
            </p>
            <h1 className="text-3xl font-semibold mt-1">
              {request.name ?? "Untitled Request"}
            </h1>
            <p className="text-base-content/70 text-sm mt-2">
              Review the request information for{" "}
              <span className="font-semibold">
                {request.retailer?.name ?? "this account"}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <Link
              to={`/request/edit/${request.uuid}`}
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
                  request.status?.name === "Pending"
                    ? "badge-warning"
                    : request.status?.name === "Approved"
                      ? "badge-success"
                      : request.status?.name === "Declined"
                        ? "badge-error"
                        : "badge-neutral"
                }
                `}
              >
                <CheckCircleIcon className="w-4 h-4" />
                {request.status?.name ?? "Unknown"}
              </span>

              {/* REQUEST TYPE */}
              {request.requestType?.name && (
                <span className="badge badge-soft badge-outline badge-info badge-lg font-medium">
                  {request.requestType.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ================= QUICK INFO ================= */}
        <div className="rounded-2xl bg-base-300/50 border border-base-100/20 px-6 py-4 text-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 opacity-60" />
              <span className="font-medium">
                {formatDate(request.date ?? null)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 opacity-60" />
              <span className="font-medium">
                {formatTime(request.startTime ?? null)} –{" "}
                {formatTime(request.endTime ?? null)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-4 h-4 opacity-60" />
              <span className="font-medium">
                {request.retailer?.name ?? "Unknown"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPinIcon className="w-4 h-4 opacity-60" />
              <span className="font-medium">{request.address ?? "—"}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-base-100/20 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              {request.createdBy?.image ? (
                <img
                  src={request.createdBy?.image.url}
                  alt={createdByLabel}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-base-100 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4 opacity-60" />
                </div>
              )}
              <span className="text-base-content/60 whitespace-nowrap">
                Created by{" "}
                <span className="font-medium text-base-content">
                  {createdByLabel}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {request.approvedBy?.image ? (
                <img
                  src={request.approvedBy?.image.url}
                  alt={approvedByLabel}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-base-100 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4 opacity-60" />
                </div>
              )}
              <span className="text-base-content/60 whitespace-nowrap">
                Approved by{" "}
                <span className="font-medium text-base-content">
                  {approvedByLabel}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-base-content/60 whitespace-nowrap">
                {request.rmmAsigned ? (
                  <>
                    <UsersIcon className="w-4 h-4 opacity-60" />
                    Assigned RMM:{" "}
                    <span className="font-medium text-base-content">
                      {rmmAssignedLabel}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-base-content">
                    No RMM assigned
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ================= MAIN GRID ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-8 items-start">
          {/* BASIC INFORMATION */}
          <div className="xl:col-span-6 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Basic Information</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem
                  label="Distributor"
                  value={request.distributor?.name ?? "Unknown"}
                  Icon={UsersIcon}
                />

                {isCarblissTenant && (
                  <InfoItem
                    label="Billing Entity"
                    value={billingEntityName ?? "—"}
                    Icon={BuildingOfficeIcon}
                  />
                )}

                <InfoItem
                  label="Request Timezone"
                  value={
                    request.timezone
                      ? `${request.timezone.name} (${request.timezone.code})`
                      : "No timezone"
                  }
                  Icon={ClockIcon}
                />

                <InfoItem
                  label="Created by"
                  value={createdByLabel}
                  Icon={UsersIcon}
                />

                <InfoItem
                  label="Requestor email"
                  value={request.requestorEmail ?? "—"}
                  Icon={UsersIcon}
                />
              </div>
            </div>
          </div>

          {/* LOCATION INFORMATION */}
          <div className="xl:col-span-6 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Location Information</p>

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
                      Icon={MapPinIcon}
                    />
                  </>
                ) : (
                  <>
                    <InfoItem
                      label="Retailer State"
                      value={request.retailer?.location?.state?.name ?? "—"}
                      Icon={MapPinIcon}
                    />
                    <InfoItem
                      label="Retailer Location"
                      value={request.retailer?.location?.name ?? "—"}
                      Icon={MapPinIcon}
                    />

                    <InfoItem
                      label="Retailer Zip"
                      value={request.retailer?.location?.zip ?? "—"}
                      Icon={MapPinIcon}
                    />
                  </>
                )}

                <div className="md:col-start-1">
                  <InfoItem
                    label="Distributor State"
                    value={request.distributor?.location?.state?.name ?? "—"}
                    Icon={MapPinIcon}
                  />
                </div>
                <InfoItem
                  label="Distributor Location"
                  value={request.distributor?.location?.name ?? "—"}
                  Icon={MapPinIcon}
                />

                <InfoItem
                  label="Distributor Zip"
                  value={request.distributor?.location?.zip ?? "—"}
                  Icon={MapPinIcon}
                />
              </div>
            </div>
          </div>

          {/* TIMEZONE INFORMATION */}
          <div className="col-span-1 md:col-span-2 xl:col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Your current timezone</p>
                <span className="badge badge-outline max-w-full truncate">
                  {formatBrowserTimezoneLabel()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem
                  label="Request Date"
                  value={formatLocalDate(request.date ?? null)}
                  Icon={CalendarIcon}
                />

                <InfoItem
                  label="Request Time"
                  value={`${formatLocalTime(request.startTime ?? null)} – ${formatLocalTime(
                    request.endTime ?? null,
                  )}`}
                  Icon={ClockIcon}
                />
              </div>
            </div>
          </div>

          {/* REQUEST DETAILS */}
          <div className="col-span-1 md:col-span-2 xl:col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <p className="font-semibold text-lg">Request Details</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem
                  label="Request Type"
                  value={request.requestType?.name ?? "Unknown"}
                  Icon={TagIcon}
                />
                <InfoItem
                  label="Status"
                  value={request.status?.name ?? "Unknown"}
                  Icon={CheckCircleIcon}
                />
              </div>
            </div>
          </div>

          {/* ================= EVENT NOTES ================= */}
          <div className="col-span-1 md:col-span-2 xl:col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4">
              <p className="font-semibold text-lg">Event Notes</p>

              <div className="rounded-xl bg-base-200/70 border border-base-100/20 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {request.notes ?? "No notes provided."}
                </p>
              </div>

              {request.declineReason?.trim() && (
                <div>
                  <p className="text-xs uppercase opacity-60">Decline Reason</p>
                  <p className="font-medium whitespace-pre-wrap">
                    {request.declineReason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="col-span-1 md:col-span-2 xl:col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="font-semibold text-lg">Request Products</p>

                <div className="flex items-center gap-3">
                  {/* FILTER */}
                  <select
                    className="select select-sm select-bordered"
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    {productTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  {/* COUNT */}
                  <span className="badge badge-outline px-3 py-2 text-sm whitespace-nowrap">
                    {request.products?.length ?? 0} products
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {paginatedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl bg-base-200 p-4 flex gap-4"
                  >
                    <div className="w-16 h-16 rounded-lg bg-base-100 flex items-center justify-center text-xs opacity-60">
                      {p.image ? (
                        <img
                          src={p.image}
                          className="object-cover rounded-lg"
                        />
                      ) : (
                        "No img"
                      )}
                    </div>

                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-base-content/60">
                        {p.productType?.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Prev
                  </button>

                  <span className="text-sm opacity-60">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MAP SECTION */}
          <div className="col-span-1 md:col-span-2 xl:col-span-12 space-y-8">
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-6 space-y-4 sticky top-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Location</p>
                <span className="text-xs opacity-60">
                  {request.coordinates.length
                    ? `${request.coordinates[0]}, ${request.coordinates[1]}`
                    : "No coordinates provided"}
                </span>
              </div>

              <LocationMap
                coordinates={request.coordinates ?? null}
                label={request.name ?? "Request Location"}
                address={request.address ?? null}
              />

              <p className="text-xs text-center opacity-60">
                Tip: Use the Edit button to update schedule, account or
                location.
              </p>
              <p>
                Last updated:{" "}
                {new Date(request.updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestCard;
