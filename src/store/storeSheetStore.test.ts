import { beforeEach, describe, expect, it } from "vitest";
import { useStoreSheetStore } from "./storeSheetStore";

describe("storeSheetStore", () => {
  beforeEach(() => {
    useStoreSheetStore.getState().closeStoreSheet();
  });

  it("opens and closes store sheet targets across storeKey, requestId, and recapId", () => {
    expect(useStoreSheetStore.getState().target).toBeNull();

    useStoreSheetStore.getState().openStoreSheet({
      storeKey: "s42",
      storeName: "BevMo West Hollywood",
      fallbackTitle: "BevMo West Hollywood",
    });
    expect(useStoreSheetStore.getState().target).toEqual({
      storeKey: "s42",
      storeName: "BevMo West Hollywood",
      fallbackTitle: "BevMo West Hollywood",
    });

    useStoreSheetStore.getState().openStoreSheet({
      requestId: "UmVxdWVzdDoxMjM=",
      storeName: "Total Wine Pasadena",
    });
    expect(useStoreSheetStore.getState().target?.requestId).toBe("UmVxdWVzdDoxMjM=");

    useStoreSheetStore.getState().openStoreSheet({
      recapId: "9f31d8c2-1111-4444-8888-abcdef012345",
      storeName: "Erewhon Silver Lake",
    });
    expect(useStoreSheetStore.getState().target?.recapId).toBe(
      "9f31d8c2-1111-4444-8888-abcdef012345",
    );

    useStoreSheetStore.getState().closeStoreSheet();
    expect(useStoreSheetStore.getState().target).toBeNull();
  });
});
