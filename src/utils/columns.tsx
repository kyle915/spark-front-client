import type {
  Column,
  RequestRow,
  EventRow,
  TenantRow,
  RecapRow,
} from "@/types/columnsTypes";
import { formatDate, formatTime } from "@/utils";

export const requestColumns: Column<RequestRow>[] = [
  { key: "name", label: "Name" },
  {
    key: "date",
    label: "Date",
    render: (_value, row) => formatDate(row.date ?? null),
  },
  {
    key: "startTime",
    label: "Start Time",
    render: (_value, row) => formatTime(row.startTime ?? null),
  },
  {
    key: "retailer",
    label: "Retailer",
    render: (_value, row) => row.retailer?.name ?? "-",
  },
  {
    key: "distributor",
    label: "Distributor",
    render: (_value, row) => row.distributor?.name ?? "-",
  },
  {
    key: "requestType",
    label: "Type",
    render: (_value, row) => row.requestType?.name ?? "-",
  },
  {
    key: "status",
    label: "Status",
    render: (_value, row) => row.status?.name ?? "-",
  },
];

export const eventColumns: Column<EventRow>[] = [
  {
    key: "name",
    label: "Event",
  },
  {
    key: "eventDate",
    label: "Date",
    render: (_value, row) => formatDate(row.request?.date ?? "-"),
  },
  {
    key: "eventStart",
    label: "Start Time",
    render: (_value, row) => formatTime(row.startTime ?? "-"),
  },
  {
    key: "eventEnd",
    label: "End Time",
    render: (_value, row) => formatTime(row.endTime ?? "-"),
  },
  {
    key: "address",
    label: "Address",
    render: (_value, row) => row.address ?? "-",
  },
  {
    key: "eventType",
    label: "Type",
    render: (_value, row) => row.eventType?.name ?? "-",
  },
  {
    key: "status",
    label: "Status",
    render: (_value, row) => row.status?.name ?? "-",
  },
  {
    key: "request",
    label: "Request",
    render: (_value, row) => row.request?.name ?? "-",
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
  eventLookup: Record<string, string> = {}
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
    key: "createdAt",
    label: "Created At",
    render: (_value, row) => formatDate(row.createdAt ?? null),
  },
];
