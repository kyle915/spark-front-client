export interface CreateRequestProductInput {
  productId: string;
  clientMutationId?: string | null;
}

export interface CreateRequestDetailInput {
  isTableNeeded: boolean;
  tableSize?: number | null;
  clientMutationId?: string | null;
}

export interface CreateRequestInput {
  // BASIC INFO
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  coordinates: number[];

  // CLIENT
  clientName: string;
  clientEmail: string;

  // DISTRIBUTOR
  distributorName: string;
  distributorEmail: string;

  // RETAILER
  retailerName: string;
  retailerAddress: string;
  retailerStoreContact: string;

  // STORE MANAGER
  storeManagerName: string;
  storeManagerPhone: string;

  // REQUEST TYPE
  requestTypeId: string;

  // TIMEZONE (obligatorio!)
  timezoneId: string;

  // PRODUCTS
  products: CreateRequestProductInput[];

  // DETAILS
  details: CreateRequestDetailInput[];

  // TENANT
  tenantId?: string | null;
}

export interface CreateRequestResponse {
  createRequestByUrl: {
    success: boolean;
    message?: string | null;
    request?: {
      id: string;
      uuid: string;
      name: string;
      date: string;
      startTime: string;
      endTime: string;
      address: string;
    } | null;
  };
}
