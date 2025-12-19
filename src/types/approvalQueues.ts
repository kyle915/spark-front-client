export type ApprovalStatus = "pending" | "approved" | "denied";

export interface ApprovalContactInfo {
  name: string;
  email: string;
}

export interface ApprovalRequestDetails {
  address: string;
  tableSize: string;
  parkingNotes: string;
  contact: ApprovalContactInfo;
  ambassador: ApprovalContactInfo;
}

export interface ApprovalRequest {
  id: string;
  account: string;
  market: string;
  date: string;
  time: string;
  requestedBy: string;
  products: string[];
  status: ApprovalStatus;
  details: ApprovalRequestDetails;
}
