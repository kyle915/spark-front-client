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
    statusId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    address: string;
    notes?: string | null;
    isNational: boolean;
}

// ------------------------------------
// Component Props
// ------------------------------------
export interface EventFormProps {
    tenants?: Tenant[];
    requests?: RequestType[];
    eventTypes: EventType[];
    statuses: EventStatus[];
    onSubmit: (data: EventFormValues) => void;
    defaultValues?: Partial<EventFormValues>;
}
