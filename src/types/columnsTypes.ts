import type { ReactNode } from "react";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: T[keyof T] | undefined, row: T) => ReactNode;
}

export interface NamedEntity {
  id: string;
  uuid?: string | null;
  name: string;
  slug?: string | null;
  date?: string | null;
}

export interface RequestRow {
  id: string;
  uuid?: string | null;
  name: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  address?: string | null;
  client?: NamedEntity | null;
  distributor?: NamedEntity | null;
  retailer?: NamedEntity | null;
  requestType?: NamedEntity | null;
  status?: NamedEntity | null;
}

export interface EventRow {
  id: string;
  uuid?: string | null;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  address?: string | null;
  notes?: string | null;
  isNational?: boolean | null;
  tenantId?: string | null;
  request?: NamedEntity | null;
  eventType?: NamedEntity | null;
  status?: NamedEntity | null;
}

export interface TenantRow {
  id: string;
  uuid?: string | null;
  name: string;
  requestUrlName?: string | null;
}

export interface RecapRow {
  id: string;
  uuid?: string | null;
  name: string;
  approved?: boolean | null;
  eventId?: string | null;
  event?: NamedEntity | null;
  createdAt?: string | null;
}

export interface UserRow {
  id: string;
  uuid?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  image?: string | null;
  role?: {
    id: string;
    uuid?: string | null;
    name: string;
  } | null;
}
