/** Pure helpers for the "Best photos" panel on a recap. */

export type PhotoPick = {
  fileId: string;
  url: string;
  category: string;
  status: string;
  note: string;
  score: number | null | undefined;
  caption: string;
  modelPick: boolean;
  staffChoice: string;
  isPick: boolean;
  canPick: boolean;
};

export type PickChoice = "pinned" | "unpinned" | "";

/** What the Pin / Unpin button does for this photo. */
export const nextChoice = (item: Pick<PhotoPick, "isPick">): PickChoice =>
  item.isPick ? "unpinned" : "pinned";

/** One short line under a photo: why it is or is not a best photo. */
export const statusLine = (item: PhotoPick): string => {
  if (!item.canPick) return item.note || "Receipt";
  if (item.staffChoice === "pinned") return "Pinned by staff";
  if (item.staffChoice === "unpinned") return "Unpinned by staff";
  if (item.status === "scored" && typeof item.score === "number") {
    return `Score ${item.score} of 100`;
  }
  if (item.status === "not_scored") return "Not scored yet";
  if (item.status === "unreadable") return "Could not be scored";
  return item.note || "Not scored";
};

export const pickCount = (items: readonly PhotoPick[]): number =>
  items.filter((i) => i.isPick).length;

/** True once the scorer has looked at any photo on the recap. */
export const anyLookedAt = (items: readonly PhotoPick[]): boolean =>
  items.some((i) => i.status !== "not_scored");

/** Best photos first, then the rest in their filed order. */
export const picksFirst = <T extends Pick<PhotoPick, "isPick">>(items: readonly T[]): T[] => [
  ...items.filter((i) => i.isPick),
  ...items.filter((i) => !i.isPick),
];
