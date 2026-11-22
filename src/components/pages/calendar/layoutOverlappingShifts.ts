/**
 * Pack concurrent calendar blocks into side-by-side columns.
 *
 * Without this, every shift uses the full day-column width, so overlapping
 * shifts paint on top of each other and their text becomes an illegible mash
 * (especially with translucent chip backgrounds).
 */

export type TimedBlock = {
  startHour: number;
  endHour: number;
};

export type LaidOutBlock<T extends TimedBlock> = T & {
  /** 0-based column within the overlapping cluster */
  col: number;
  /** Total columns in that cluster (width = 1/cols) */
  cols: number;
};

/**
 * Greedy interval packing, Google-Calendar style:
 * sort by start, grow overlapping clusters, assign the first free column
 * inside each cluster.
 */
export function layoutOverlappingShifts<T extends TimedBlock>(
  blocks: T[],
): LaidOutBlock<T>[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort(
    (a, b) => a.startHour - b.startHour || b.endHour - a.endHour,
  );

  const result: LaidOutBlock<T>[] = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    const colEnds: number[] = [];
    const assigned: { block: T; col: number }[] = [];

    for (const block of cluster) {
      let col = colEnds.findIndex((end) => end <= block.startHour + 1e-9);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(block.endHour);
      } else {
        colEnds[col] = block.endHour;
      }
      assigned.push({ block, col });
    }

    const cols = Math.max(1, colEnds.length);
    for (const { block, col } of assigned) {
      result.push({ ...block, col, cols });
    }

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const block of sorted) {
    if (cluster.length > 0 && block.startHour >= clusterEnd - 1e-9) {
      flush();
    }
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.endHour);
  }
  flush();

  return result;
}
