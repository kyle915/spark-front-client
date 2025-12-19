export interface RowItem {
  onbrand_id: number;
  date: string;
  account: string;
  account_normalized: string;
  brand_ambassador: string;
  account_spend_amount: number;
  rmm: string;
  market: string;
  consumers: number;
  cans: number;
  cases: number;
  first_time_consumers: number;
}

export interface RetailDetail {
  onbrand_id: number;
  brand_ambassador: string;
  date: string;
  account: string;
  market: string;
  single_cans: number;
  multipacks: number;
  skus_out_of_stock: string[];
  sampled_products: string[];
  account_spend: number;
  total_consumers: number;
  first_time_consumers: number;
  brand_aware: number;
  willing_to_purchase: number;
  not_willing_to_purchase: number;
  demographics: string;
  feedback: string;
  product_photos: string[];
  sampling_photos: string[];
  table_setup_photos: string[];
  receipt_photos: string[];
}
