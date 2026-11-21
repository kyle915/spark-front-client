/**
 * "Wrong store? Fix it" on the walk-up page.
 *
 * A BA who picked or typed the wrong store at identify used to stay logged
 * there all shift. The API now moves the BA's own walk-in event in place
 * (`POST checkin/<code>/change-store`) to where their phone says they are,
 * after a GPS check. These helpers decide when to offer it and what the BA
 * reads. Time-sheet brands log locations, not stores, so their copy says
 * "location" and never asks for a store name.
 */
import { formatMilesForConfirm } from "./storeProximity";

/** What the API says about moving this shift (`session.storeChange`). */
export type StoreChangeState = {
  allowed: boolean;
  code?: string;
  message?: string;
  /** Time-sheet brand: an event location, never a store name. */
  addressOnly?: boolean;
  /** Retail Sampling: the store name is required. */
  storeNameRequired?: boolean;
  /** Event activation: the name is an optional venue. */
  venue?: boolean;
  maxDistanceKm?: number;
  /** The store the shift is logged at now ("" when none). */
  storeName?: string;
};

/** What moved, from the change-store response. */
export type StoreChangeResult = {
  fromAddress: string;
  toAddress: string;
  fromStore: string;
  toStore: string;
  distanceKm: number | null;
  farOverride: boolean;
  createdStore: boolean;
  repeated?: boolean;
};

/** A known store Spark found at or near the place. */
export type KnownStore = {
  name: string;
  address: string;
  retailerUuid?: string | null;
  source?: string;
  distanceM?: number | null;
};

/** The store-lookup response. */
export type StoreLookup = {
  address: string;
  city?: string;
  state?: string;
  postcode?: string;
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceKm: number | null;
  far: boolean;
  maxDistanceKm: number;
  store: KnownStore | null;
  stores?: { name: string; address: string }[];
};

/** Refusals the BA can't act on from the page: show nothing at all. */
const HIDDEN_CODES = new Set(["not_clocked_in", "market_mode"]);

/**
 * Show the control at all? Only once the BA has clocked in (or out) and
 * before the recap is filed. Never on a recap-only link, on a prior-day
 * leftover, or while a recap is waiting to send (it was filed against this
 * store).
 */
export function showStoreFix(opts: {
  state: StoreChangeState | undefined;
  clockState: string | undefined;
  hasRecap: boolean;
  recapOnly: boolean;
  recapQueued: boolean;
  leftover: boolean;
}): boolean {
  if (!opts.state) return false;
  if (opts.hasRecap || opts.recapOnly || opts.recapQueued || opts.leftover) return false;
  if (opts.clockState !== "clocked_in" && opts.clockState !== "clocked_out") return false;
  if (!opts.state.allowed && HIDDEN_CODES.has(opts.state.code ?? "")) return false;
  return true;
}

/** "Wrong store?" / "Wrong location?" */
export function fixLabel(state: Pick<StoreChangeState, "addressOnly" | "venue">): string {
  if (state.addressOnly) return "Wrong location? Fix it";
  if (state.venue) return "Wrong venue? Fix it";
  return "Wrong store? Fix it";
}

/** The line the control sits on: "Store: Kroger · 123 Main St". */
export function currentPlaceLine(
  state: Pick<StoreChangeState, "addressOnly" | "venue" | "storeName">,
  address: string | null | undefined,
): { label: string; value: string } {
  const addr = (address ?? "").trim();
  if (state.addressOnly) return { label: "Location", value: addr || "Not set" };
  const store = (state.storeName ?? "").trim();
  const value = [store, addr].filter(Boolean).join(" · ") || "Not set";
  return { label: state.venue ? "Venue" : "Store", value };
}

/** "You're at <address>. Is this where you're working?" */
export function hereQuestion(address: string): string {
  return `You're at ${address.trim()}. Is this where you're working?`;
}

/** The store-name box: label, hint and whether it must be filled. */
export function storeNameField(state: StoreChangeState): {
  show: boolean;
  label: string;
  hint: string;
  required: boolean;
  placeholder: string;
} {
  if (state.addressOnly) {
    return { show: false, label: "", hint: "", required: false, placeholder: "" };
  }
  if (state.venue) {
    return {
      show: true,
      label: "Venue name (optional)",
      hint: "The event or venue, if it has a name.",
      required: false,
      placeholder: "e.g. Grand Park",
    };
  }
  return {
    show: true,
    label: "Store name",
    hint: state.storeNameRequired
      ? "Needed so your work counts for the right store."
      : "The store you're standing in.",
    required: Boolean(state.storeNameRequired),
    placeholder: "e.g. Kroger",
  };
}

/** Plain far-away warning shown before the BA can say "I'm sure". */
export function farWarningCopy(distanceKm: number, addressOnly = false): string {
  const miles = formatMilesForConfirm(distanceKm * 0.621371);
  const what = addressOnly ? "location" : "store";
  return `That address is about ${miles} miles from where your phone says you are. Only continue if this is the ${what} you're at right now.`;
}

/** The confirm screen's question. */
export function moveConfirmCopy(opts: {
  storeName: string;
  address: string;
  addressOnly?: boolean;
}): string {
  const place = [opts.addressOnly ? "" : opts.storeName.trim(), opts.address.trim()]
    .filter(Boolean)
    .join(" · ");
  return `Move this shift to ${place}? Your clock-in time stays.`;
}

/** One line after a move. */
export function moveResultCopy(result: StoreChangeResult, addressOnly = false): string {
  const place = [addressOnly ? "" : result.toStore, result.toAddress].filter(Boolean).join(" · ");
  return `Moved to ${place}. Your clock-in time didn't change.`;
}

/** A store name the BA must still type before Continue works. */
export function storeNameMissing(state: StoreChangeState, name: string): boolean {
  return storeNameField(state).required && !name.trim();
}

/** A fresh per-attempt key so a retry or double tap is one move. */
export function newRequestKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** The change-store request body. */
export function buildChangeStoreBody(opts: {
  session: string;
  address: string;
  storeName: string;
  addressOnly?: boolean;
  gps: { lat: number; lng: number; accuracy?: number | null } | null;
  place: { lat: number; lng: number } | null;
  state?: string;
  source: "gps" | "search" | "typed";
  confirmFar: boolean;
  requestKey: string;
}): Record<string, unknown> {
  return {
    session: opts.session,
    address: opts.address.trim(),
    ...(!opts.addressOnly && opts.storeName.trim() ? { storeName: opts.storeName.trim() } : {}),
    ...(opts.gps
      ? {
          latitude: opts.gps.lat,
          longitude: opts.gps.lng,
          ...(opts.gps.accuracy != null ? { accuracy: Math.round(opts.gps.accuracy) } : {}),
        }
      : {}),
    ...(opts.place ? { placeLatitude: opts.place.lat, placeLongitude: opts.place.lng } : {}),
    ...(opts.state ? { state: opts.state } : {}),
    addressSource: opts.source,
    ...(opts.confirmFar ? { confirmFar: true } : {}),
    requestKey: opts.requestKey,
  };
}
