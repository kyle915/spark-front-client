export interface CreateRequestProductInput {
  productId: string;
  clientMutationId?: string | null;
}

export interface CreateRequestDetailInput {
  isTableNeeded: boolean;
  tableSize?: number | null;
  clientMutationId?: string | null;
}

export interface CreateRequestWithDependenciesInput {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  coordinates: number[];
  clientId: string;
  distributorId: string;
  retailerId: string;
  requestTypeId: string;
  products: CreateRequestProductInput[];
  details: CreateRequestDetailInput[];
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
