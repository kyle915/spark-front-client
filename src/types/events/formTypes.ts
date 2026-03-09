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
  rmmAsignedId?: string | null;
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
  isNationalRetailer?: boolean;
  associateRequest?: boolean;
  requestLoading?: boolean;
  storeManagerName?: string | null;
  storeManagerPhone?: string | null;
  onRequestSearch?: (query: string) => void;
}

// ------------------------------------
// Component Props
// ------------------------------------
export interface EventFormProps {
  mode: "create" | "edit";
  // tenants?: Tenant[];
  // requests?: RequestType[];
  eventTypes: EventType[];
  tenantId: string;
  rmmClients?: {
    id: string;
    uuid: string;
    firstName: string;
    lastName: string;
  }[];
  timezones?: { id: string; name: string; code: string; offset: number }[];
  requestStoreManagers?: CatalogItem[];
  userIdLoggin?: string;
  userUuidLoggin?: string;
  clients?: CatalogItem[];
  locations?: Location[];
  states?: CatalogItem[];
  onStateChange?: (stateId: string | null) => void;
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (data: EventFormValues) => void;
  showRequestField?: boolean;
  showAssociateRequestToggle?: boolean;
  contactMode?: "request" | "manual";
  requestContactInfo?: RequestContactInfo;
  enableContactSection?: boolean;
  onRefetch?: (key: "distributors" | "retailers" | "clients") => void;
  showIsNational?: boolean;
  disableStateSelect?: boolean;
  hideDistributorFields?: boolean;
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
