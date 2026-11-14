import type {
  Column,
  RequestRow,
  EventRow,
  TenantRow,
  RecapRow,
  UserRow,
  DistributorRow,
  RetailerRow,
  ProductTypeRow,
  EventTypeRow,
  LocationRow,
  RequestTypeRow,
  CustomRecapRow,
} from "@/types/columnsTypes";
import { formatDate, formatTime } from "@/utils";
import { formatInstantDate } from "@/utils/formatInstantDate";

const getRecapState = (row: RecapRow) =>
  row.eventState ??
  row.state?.code ??
  row.event?.state?.code ??
  row.event?.retailer?.location?.state?.code ??
  row.state?.name ??
  row.event?.state?.name ??
  row.event?.request?.state?.name ??
  "-";

const getRecapLocation = (row: RecapRow) =>
  row.eventRetailer ??
  row.event?.retailer?.name ??
  row.event?.address ??
  row.location?.name ??
  row.event?.location?.name ??
  row.event?.request?.location?.name ??
  "-";

export const requestColumns: Column<RequestRow>[] = [
  {
    key: "name",
    label: "Request",
    render: (_v, row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        {row.requestType?.name && (
          <span className="text-xs opacity-60">{row.requestType.name}</span>
        )}
      </div>
    ),
  },
  {
    key: "schedule",
    label: "Schedule",
    render: (_v, row) => (
      <div className="flex flex-col text-sm">
        <span className="font-medium">{formatDate(row.date ?? null)}</span>
        <span className="opacity-60">
          {formatTime(row.startTime ?? null)} -{" "}
          {formatTime(row.endTime ?? null)}
        </span>
      </div>
    ),
  },

  {
    key: "retailer",
    label: "Retailer",
    render: (_v, row) => (
      <span className="font-medium">{row.retailer?.name ?? "-"}</span>
    ),
  },
  {
    key: "address",
    label: "Address",
    render: (_v, row) => (
      <div className="group relative max-w-[220px]">
        <span className="block truncate">{row.address ?? "-"}</span>
        {row.address ? (
          <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-xs rounded-md border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg group-hover:block whitespace-normal break-words">
            {row.address}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    key: "state",
    label: "State",
    render: (_v, row) => (
      <span>{row.state?.name ?? row.retailer?.location?.state?.name ?? "-"}</span>
    ),
  },
  {
    key: "city",
    label: "City",
    render: (_v, row) => <span>{row.location?.name ?? row.retailer?.location?.name ?? "-"}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (_v, row) => {
      const statusColorMap: Record<string, string> = {
        Pending: "badge-warning",
        Approved: "badge-success",
        Rejected: "badge-error",
        Cancelled: "badge-neutral",
      };

      return (
        <span
          className={`badge badge-sm badge-outline rounded-2xl ${
            statusColorMap[row.status?.name ?? ""] ?? ""
          }`}
        >
          {row.status?.name ?? "-"}
        </span>
      );
    },
  },
];

export const eventColumns: Column<EventRow>[] = [
  {
    key: "name",
    label: "Event",
    render: (_v, row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        {row.name && <span className="text-xs opacity-60">{row.name}</span>}
      </div>
    ),
  },
  {
    key: "schedule",
    label: "Schedule",
    render: (_v, row) => (
      <div className="flex flex-col text-sm">
        <span className="font-medium">{formatDate(row.date ?? "-")}</span>
      </div>
    ),
  },
  {
    key: "startTime",
    label: "Time",
    render: (_v, row) => (
      <div className="flex flex-col text-sm">
        <span className="font-medium">
          {formatTime(row.startTime || null)} –{" "}
          {formatTime(row.endTime || null)}
        </span>
      </div>
    ),
  },
  {
    key: "address",
    label: "Address",
    render: (_v, row) => (
      <span className="block max-w-[220px] truncate" title={row.address ?? ""}>
        {row.address ?? "-"}
      </span>
    ),
  },
  {
    key: "eventType",
    label: "Type",
    render: (_v, row) => (
      <span className="badge badge-soft badge-secondary badge-sm">
        {row.eventType?.name ?? "-"}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (_v, row) => {
      const statusColorMap: Record<string, string> = {
        Pending: "badge-warning",
        Approved: "badge-success",
        Rejected: "badge-error",
        Cancelled: "badge-neutral",
      };

      return (
        <span
          className={`badge badge-sm badge-outline ${
            statusColorMap[row.status?.name ?? ""] ?? ""
          }`}
        >
          {row.status?.name ?? "-"}
        </span>
      );
    },
  },
];

export const tenantColumns: Column<TenantRow>[] = [
  {
    key: "name",
    label: "Name",
  },
  {
    key: "requestUrlName",
    label: "Request URL Name",
    render: (_value, row) => row.requestUrlName ?? "-",
  },
];

export const createRecapColumns = (
  eventLookup: Record<string, string> = {},
): Column<RecapRow>[] => [
  {
    key: "name",
    label: "Recap",
  },
  {
    key: "eventId",
    label: "Event",
    render: (_value, row) => {
      if (row.event?.name) return row.event.name;
      const label = row.eventId ? eventLookup[row.eventId] : null;
      return label ?? row.eventId ?? "-";
    },
  },
  {
    key: "retailerState",
    label: "State",
    render: (_value, row) => getRecapState(row),
  },
  {
    key: "retailerLocation",
    label: "City",
    render: (_value, row) => getRecapLocation(row),
  },
  {
    key: "eventAddress",
    label: "Event Address",
    render: (_value, row) => row.event?.address ?? "-",
  },
  {
    key: "eventDate",
    label: "Event Date",
    render: (_value, row) => formatDate(row.eventDate ?? row.event?.date ?? null),
  },
];

export const createCustomRecapColumns = (): Column<CustomRecapRow>[] => [
  {
    key: "name",
    label: "Recap",
  },
  {
    key: "event",
    label: "Event",
    render: (_value, row) => row.event?.name ?? "-",
  },
  {
    key: "ambassador",
    label: "Ambassador",
    render: (_value, row) =>
      row.ambassador?.user
        ? `${row.ambassador.user.firstName} ${row.ambassador.user.lastName}`
        : "-",
  },
  {
    key: "state",
    label: "State",
    render: (_value, row) => row.state?.name ?? "-",
  },
  {
    key: "location",
    label: "City",
    render: (_value, row) => row.location?.name ?? "-",
  },
  {
    key: "retailer",
    label: "Retailer",
    render: (_value, row) => row.retailer?.name ?? "-",
  },
  {
    key: "submittedAt",
    label: "Submitted At",
    // An instant stamped in UTC: convert to the viewer's day, don't slice.
    render: (_value, row) =>
      formatInstantDate(row.submittedAt ?? row.createdAt ?? null),
  },
];

export const userColumns: Column<UserRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (_value, row) => `${row.firstName} ${row.lastName}`.trim() || "-",
  },
  {
    key: "email",
    label: "Email",
  },
  {
    key: "role",
    label: "Role",
    render: (_value, row) => row.role?.name ?? "-",
  },
];

export const distributorColumns: Column<DistributorRow>[] = [
  {
    key: "name",
    label: "Name",
  },
  {
    key: "email",
    label: "Email",
    render: (value) => value ?? "—",
  },
];

export const retailerColumns: Column<RetailerRow>[] = [
  { key: "name", label: "Name" },
  {
    key: "address",
    label: "Address",
    render: (value) => (value ? String(value) : "—"),
  },
  {
    key: "storeContact",
    label: "Store Contact",
    render: (value) => (value ? String(value) : "—"),
  },
];

export const productTypeColumns: Column<ProductTypeRow>[] = [
  {
    key: "name",
    label: "Name",
  },
];

export const eventTypeColumns: Column<EventTypeRow>[] = [
  {
    key: "name",
    label: "Name",
  },
  {
    key: "isDefault",
    label: "Default",
    render: (value) => (value ? "Yes" : "No"),
  },
];

export const locationColumns: Column<LocationRow>[] = [
  {
    key: "name",
    label: "Name",
  },
  {
    key: "address",
    label: "Address",
  },
];

export const requestTypeColumns: Column<RequestTypeRow>[] = [
  { key: "name", label: "Name" },
];
