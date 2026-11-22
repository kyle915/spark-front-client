import { create } from "zustand";

export interface StoreSheetTarget {
  storeKey?: string | null;
  requestId?: string | null;
  recapId?: string | null;
  storeName?: string | null;
  address?: string | null;
  state?: string | null;
  fallbackTitle?: string | null;
}

interface StoreSheetState {
  target: StoreSheetTarget | null;
  openStoreSheet: (target: StoreSheetTarget) => void;
  closeStoreSheet: () => void;
}

export const useStoreSheetStore = create<StoreSheetState>((set) => ({
  target: null,
  openStoreSheet: (target) => set({ target }),
  closeStoreSheet: () => set({ target: null }),
}));
