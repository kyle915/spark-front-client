// ------------------
// Types for entities
// ------------------
export interface Tenant {
  id: string;
  name: string;
  uuid?: string;
}

export interface RequestType {
  id: string;
  title: string;
  uuid?: string;
}

interface CatalogItem {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  storeContact?: string | null;
  code?: string | null;
}

export interface RequestStoreManagerItem {
  id: string;
  name: string;
  phone: string;
  uuid?: string;
  requestId?: string | null;
}

export interface EventType {
  id: string;
  name: string;
  uuid?: string;
  tenantId?: string;
  isDefault?: boolean;
}

export interface EventStatus {
  id: string;
  name: string;
  uuid?: string;
  tenantId?: string;
  isDefault?: boolean;
}

// ------------------------------------
// Type for form data based on your model
// ------------------------------------
export interface EventFormValues {
  name: string;
  tenant: string;
  requestId?: string | null;
  eventTypeId?: string | null;
  tenantId?: string | null;
  date?: string | null;
  distributorName?: string | null;
  distributorEmail?: string | null;
  distributorId?: string | null;
  retailerName?: string | null;
  retailerAddress?: string | null;
  retailerStoreContact?: string | null;
  retailerId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  address: string;
  notes?: string | null;
  isNational: boolean;
  distributorLocationId?: string | null;
  retailerLocationId?: string | null;
  coordinates?: number[] | null;
  timezoneId?: string | null;
  stateId: string | null;
  entitiesLocationId?: string | null;
  associateRequest?: boolean;
  requestLoading?: boolean;
  onRequestSearch?: (query: string) => void;
}

// ------------------------------------
// Component Props
// ------------------------------------
export interface EventFormProps {
  mode: "create" | "edit";
  tenants?: Tenant[];
  requests?: RequestType[];
  eventTypes: EventType[];
  timezones?: { id: string; name: string; code: string; offset: number }[];
  tenantId: string;
  clients?: CatalogItem[];
  distributors?: CatalogItem[];
  showRequestField?: boolean;
  showAssociateRequestToggle?: boolean;
  retailers?: CatalogItem[];
  states?: CatalogItem[];
  onStateChange?: (stateId: string | null) => void;
  locations?: Location[];
  requestContactInfo?: RequestContactInfo;
  enableContactSection?: boolean;
  contactMode?: "request" | "manual";
  onSubmit: (data: EventFormValues) => void;
  defaultValues?: Partial<EventFormValues>;
  onRefetch?: (key: "distributors" | "retailers" | "clients") => void;
}

export interface RequestContactInfo {
  clientName?: string | null;
  clientEmail?: string | null;
  distributorName?: string | null;
  distributorEmail?: string | null;
  retailerName?: string | null;
  retailerAddress?: string | null;
  retailerStoreContact?: string | null;
  storeManagerId?: string | null;
  storeManagerName?: string | null;
  storeManagerPhone?: string | null;
}

export interface Location {
  id: string;
  name: string;
  uuid?: string;
}
