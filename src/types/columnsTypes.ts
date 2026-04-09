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

type RequestLocation = {
  id?: string;
  name?: string | null;
  state?: {
    id?: string;
    name?: string | null;
    code?: string | null;
  } | null;
};

type RequestRetailer = NamedEntity & {
  location?: RequestLocation | null;
};

type RequestState = {
  id?: string;
  name?: string | null;
  code?: string | null;
};

export interface RequestRow {
  id: string;
  uuid?: string | null;
  name: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  address?: string | null;
  location?: RequestLocation | null;
  state?: RequestState | null;
  client?: NamedEntity | null;
  distributor?: NamedEntity | null;
  retailer?: RequestRetailer | null;
  requestType?: NamedEntity | null;
  status?: NamedEntity | null;
  event?: NamedEntity | null;
}

export interface EventRow {
  id: string;
  uuid?: string | null;
  name: string;
  date?: string | null;
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
  event?:
    | (NamedEntity & {
        address?: string | null;
        retailer?: RecapEntityWithLocation | null;
        distributor?: RecapEntityWithLocation | null;
        request?: {
          retailer?: RecapEntityWithLocation | null;
          distributor?: RecapEntityWithLocation | null;
        } | null;
      })
    | null;
  createdAt?: string | null;
}

type RecapEntityWithLocation = {
  location?: {
    name?: string | null;
    state?: {
      name?: string | null;
      code?: string | null;
    } | null;
  } | null;
};

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

export interface DistributorRow {
  id: string;
  uuid?: string | null;
  name: string;
  email?: string | null;
}

export type RetailerRow = {
  id: string;
  uuid: string;
  name: string;
  address?: string | null;
  storeContact?: string | null;
};

export type ProductTypeRow = {
  id: string;
  uuid: string;
  name: string;
};

export type EventTypeRow = {
  id: string;
  uuid: string;
  name: string;
  isDefault: boolean;
};

export type LocationRow = {
  id: string;
  uuid: string;
  name: string;
  code: string;
  zip: string;
};

export type RequestTypeRow = {
  id: string;
  uuid: string;
  name: string;
};
