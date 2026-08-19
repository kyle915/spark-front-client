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
  requestorEmail: string;
  stateId?: string | null;
  locationId?: string | null;

  // CLIENT (not collected in UI, sent as placeholder)
  clientName: string;
  clientEmail: string;

  // DISTRIBUTOR
  distributorId?: string | null;
  billingEntityId?: string | null;
  distributorName: string;
  distributorEmail: string;

  // RETAILER
  retailerId?: string | null;
  retailerName: string;
  retailerAddress: string;
  retailerStoreContact: string;

  // STORE MANAGER
  storeManagerName: string;
  storeManagerPhone: string;

  // SCHEDULING — required choice: "already_scheduled" | "needs_scheduling"
  schedulingStatus?: string | null;

  // Torch form: "Is Non-Active Product Required?" Yes → true, No → false
  isNonActiveProductRequired?: boolean | null;

  // Torch form: optional "How many cases to be shipped?" (5MG+10MG gate)
  casesToBeShipped?: string | null;

  // Torch On-Premise / Event Activation extras (slug keee-torch-thc only)
  accountSpendAmount?: string | null;
  eventAssetsNeeded?: string | null;
  loadInTime?: string | null;
  onsitePoc?: string | null;
  additionalTeamDetails?: string | null;

  // REQUEST TYPE
  requestTypeId: string;

  // TIMEZONE (obligatorio!)
  timezoneId: string;

  // PRODUCTS
  products: CreateRequestProductInput[];

  // DETAILS
  details: CreateRequestDetailInput[];

  // NOTES
  notes: string;
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
      rmmAsigned?: {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      } | null;
    } | null;
  };
}
