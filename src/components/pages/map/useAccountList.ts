import { useCallback, useEffect, useRef, useState } from "react";
import { loadUploadedAccounts } from "@/lib/accounts";
import {
  fetchAccountList,
  placeAccountListEntries,
  saveAccountList,
  type SaveSummary,
} from "./accountListApi";
import { toListInput, type ListEntry, type ListInput } from "./accountStores";

/** Address lookups per call; the server stops each call after a few seconds. */
const PLACE_BATCH = 25;
/** A hard stop so a server that never finishes cannot loop a tab forever. */
const MAX_PLACE_CALLS = 400;

const savedFlag = (tenantId: string) => `@spark.uploadedAccounts.saved/${tenantId}`;

/**
 * Lists uploaded before this change live only in the browser that uploaded
 * them. The first time that browser opens the map, copy the list to the
 * server. The browser's copy is left where it is; a flag records that it has
 * been sent, so it is sent once. A failure leaves the flag unset and the copy
 * is tried again on the next visit.
 */
async function sendBrowserList(tenantId: string): Promise<void> {
  try {
    if (localStorage.getItem(savedFlag(tenantId))) return;
  } catch {
    return;
  }
  const local = loadUploadedAccounts(tenantId);
  if (local.length === 0) return;
  await saveAccountList(tenantId, local.map(toListInput));
  try {
    localStorage.setItem(savedFlag(tenantId), new Date().toISOString());
  } catch {
    /* private mode: the server ignores rows it already has */
  }
}

export type AccountListState = {
  entries: ListEntry[];
  /** "off": no brand chosen, so there is no list to show. */
  status: "off" | "loading" | "ready" | "error";
  /** While addresses are being looked up: how many are left, of how many. */
  placing: { remaining: number; total: number } | null;
  /** True when the address lookup is off or failing right now. */
  lookupOff: boolean;
  upload: (rows: ReadonlyArray<ListInput>) => Promise<SaveSummary>;
};

/** A brand's uploaded account list, saved on the server. */
export function useAccountList(tenantId: string | null): AccountListState {
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [status, setStatus] = useState<AccountListState["status"]>("off");
  const [placing, setPlacing] = useState<AccountListState["placing"]>(null);
  const [lookupOff, setLookupOff] = useState(false);
  // Bumped when the brand changes or the page goes away: any loop still
  // running for the old brand sees a different number and stops.
  const run = useRef(0);

  // One lookup loop at a time. A loop already running also picks up rows
  // saved after it started, because it runs until none are left.
  const placingFor = useRef<number | null>(null);

  const place = useCallback(async (tid: string, mine: number) => {
    if (placingFor.current === mine) return;
    placingFor.current = mine;
    let total: number | null = null;
    try {
      for (let i = 0; i < MAX_PLACE_CALLS; i += 1) {
        const r = await placeAccountListEntries(tid, PLACE_BATCH);
        if (run.current !== mine) return;
        if (total === null) total = r.remaining + r.placed + r.notFound;
        setPlacing({ remaining: r.remaining, total });
        if (!r.lookupAvailable) {
          setLookupOff(true);
          break;
        }
        if (r.remaining === 0 || r.placed + r.notFound === 0) break;
        // Let pins appear as they are found, not all at the end.
        if (i % 4 === 3) {
          const rows = await fetchAccountList(tid);
          if (run.current !== mine) return;
          setEntries(rows);
        }
      }
      const rows = await fetchAccountList(tid);
      if (run.current === mine) setEntries(rows);
    } catch {
      /* the list on screen stays; the next visit picks the rest up */
    } finally {
      if (placingFor.current === mine) placingFor.current = null;
      if (run.current === mine) setPlacing(null);
    }
  }, []);

  useEffect(() => {
    run.current += 1;
    const mine = run.current;
    setEntries([]);
    setPlacing(null);
    setLookupOff(false);
    if (!tenantId) {
      setStatus("off");
      return;
    }
    setStatus("loading");
    void (async () => {
      try {
        await sendBrowserList(tenantId).catch(() => undefined);
        const rows = await fetchAccountList(tenantId);
        if (run.current !== mine) return;
        setEntries(rows);
        setStatus("ready");
        if (rows.some((e) => e.positionStatus === "pending")) {
          await place(tenantId, mine);
        }
      } catch {
        if (run.current === mine) setStatus("error");
      }
    })();
    return () => {
      run.current += 1;
    };
  }, [tenantId, place]);

  const upload = useCallback(
    async (rows: ReadonlyArray<ListInput>): Promise<SaveSummary> => {
      if (!tenantId) throw new Error("Choose a brand first.");
      const mine = run.current;
      const summary = await saveAccountList(tenantId, rows);
      const saved = await fetchAccountList(tenantId);
      if (run.current !== mine) return summary;
      setEntries(saved);
      setStatus("ready");
      if (saved.some((e) => e.positionStatus === "pending")) {
        void place(tenantId, mine);
      }
      return summary;
    },
    [tenantId, place],
  );

  return { entries, status, placing, lookupOff, upload };
}
