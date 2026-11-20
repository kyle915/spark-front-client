/**
 * "Wrong program? Change it" on the walk-up page.
 *
 * On a multi-program link the BA picks a program at identify, and that pick
 * decides the event's recap form. A wrong pick used to trap them on the wrong
 * form until staff fixed the event by hand. The API now switches the BA's own
 * walk-in event in place (`POST checkin/<code>/change-program`) and hands back
 * the draft re-keyed for the new form; these helpers decide when to offer it
 * and move the on-phone draft over.
 */
import type { PhotoBucket } from "./checkinTypes";
import type { ProgramOption } from "./eventTypeDescriptor";
import { programLabel } from "./eventTypeDescriptor";
import type { DraftPhoto } from "./photoDraft";
import type { RecapDraft } from "./recapDraft";

/** What the API says about switching this shift (`session.programChange`). */
export type ProgramChangeState = {
  allowed: boolean;
  code?: string;
  message?: string;
};

/** What carried over, from the change-program response. */
export type ProgramChangeResult = {
  from: string;
  to: string;
  carried: number;
  dropped: string[];
  photos: number;
  photosMoved: number;
};

/**
 * Show the control at all? Only on a link with two or more programs, before
 * the recap is filed, and never on a time clock. A recap waiting to send is
 * already the old form's answers, so the switch waits until it lands.
 */
export function showProgramSwitch(opts: {
  programs: ProgramOption[] | undefined;
  currentId: string | null | undefined;
  hasRecap: boolean;
  timesheetOnly: boolean;
  recapQueued: boolean;
  leftover: boolean;
}): boolean {
  if ((opts.programs?.length ?? 0) < 2) return false;
  if (!opts.currentId) return false;
  if (opts.hasRecap || opts.timesheetOnly || opts.leftover) return false;
  return !opts.recapQueued;
}

/** The programs the BA can switch to (every one but the current). */
export function otherPrograms(
  programs: ProgramOption[] | undefined,
  currentId: string | null | undefined,
): ProgramOption[] {
  return (programs ?? []).filter((p) => p.id !== currentId);
}

/** The current program as the BA saw it in the picker. */
export function currentProgramLabel(
  programs: ProgramOption[] | undefined,
  current: { id: string; name: string } | null | undefined,
): string {
  if (!current) return "";
  const match = (programs ?? []).find((p) => p.id === current.id);
  return match ? programLabel(match) : current.name;
}

/** The plain confirmation the BA reads before switching. */
export function switchConfirmCopy(target: Pick<ProgramOption, "name" | "label">): string {
  const name = programLabel(target);
  return `Switch to ${name}? You'll answer the ${name} recap instead. Your clock-in stays.`;
}

/** One line after a switch: what moved and what didn't. */
export function switchResultCopy(result: ProgramChangeResult, label: string): string {
  const parts = [`Switched to ${label}.`];
  if (result.carried > 0) {
    parts.push(
      `${result.carried} ${result.carried === 1 ? "answer" : "answers"} carried over.`,
    );
  }
  if (result.dropped.length > 0) {
    parts.push(
      `${result.dropped.length} ${
        result.dropped.length === 1 ? "answer isn't" : "answers aren't"
      } on the new form, so ${result.dropped.length === 1 ? "it was" : "they were"} cleared.`,
    );
  }
  if (result.photosMoved > 0) {
    parts.push(
      `${result.photosMoved} ${result.photosMoved === 1 ? "photo" : "photos"} moved to Other photos.`,
    );
  }
  return parts.join(" ");
}

/**
 * The on-phone photo list after a switch. Every photo is kept. Its bucket
 * comes from the server's carried draft when it knows the photo, else it
 * stays only when the new program has that bucket; otherwise the photo moves
 * to the generic pile.
 */
export function remapDraftPhotos(
  photos: DraftPhoto[],
  carried: RecapDraft | null | undefined,
  newBuckets: PhotoBucket[] | undefined,
): DraftPhoto[] {
  const bucketIds = new Set((newBuckets ?? []).map((b) => b.id));
  const fromServer = new Map<string, string | null>();
  for (const p of carried?.photos ?? []) {
    if (p && typeof p.id === "string") fromServer.set(p.id, p.category ?? null);
  }
  return photos.map((photo) => {
    const known = fromServer.has(photo.id) ? fromServer.get(photo.id) ?? null : photo.category;
    const category = known !== null && bucketIds.has(known) ? known : null;
    return category === photo.category ? photo : { ...photo, category };
  });
}

/** The change-program request body. */
export function buildChangeProgramBody(opts: {
  session: string;
  eventTypeId: string;
  storeName?: string;
  draft?: RecapDraft | null;
}): Record<string, unknown> {
  return {
    session: opts.session,
    eventTypeId: opts.eventTypeId,
    ...(opts.storeName?.trim() ? { storeName: opts.storeName.trim() } : {}),
    ...(opts.draft ? { draft: opts.draft } : {}),
  };
}
